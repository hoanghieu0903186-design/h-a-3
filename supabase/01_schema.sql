-- =====================================================================
-- GIẢI MÃ BẢN ĐỒ NGUYÊN TỐ - Lược đồ cơ sở dữ liệu, RLS và hàm RPC
-- Chạy file này trước, sau đó chạy 02_seed.sql (Supabase > SQL Editor).
-- Toàn bộ logic phân quyền / chấm bài nằm trong các hàm SECURITY DEFINER.
-- Đáp án chuẩn nằm ở bảng task_answers: RLS bật, KHÔNG có policy, thu hồi mọi quyền
-- của anon/authenticated => trình duyệt không thể đọc trực tiếp.
-- =====================================================================

-- ---------- BẢNG ----------
create table public.tasks (
  id        int primary key,
  title     text   not null,
  kind      text   not null check (kind in ('z', 'config')),
  fact      text   not null,
  prompt    text   not null,
  fields    text[] not null,   -- các phần bắt buộc: element, cell, z, period, group, block
  options   text[] not null    -- ký hiệu các thẻ lựa chọn (đáp án + thẻ nhiễu)
);

create table public.task_answers (
  task_id      int primary key references public.tasks(id) on delete cascade,
  symbol       text not null,
  element_name text not null,
  z            int  not null,
  period       int  not null,
  grp          int  not null,
  block        text not null,
  hint         text not null,
  explanation  text not null
);

create table public.rooms (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  teacher_id       uuid not null,
  status           text not null default 'open' check (status in ('open', 'closed')),
  phase            text not null default 'lobby'
                   check (phase in ('lobby', 'briefing', 'working', 'review', 'confirm', 'finished')),
  phase_ends_at    timestamptz,
  started_at       timestamptz,
  review_edit_open boolean not null default false,
  hint_used        boolean not null default false,
  hint_used_at     timestamptz,
  results_visible  boolean not null default false,
  final_status     text check (final_status in ('DAT', 'CHO_XAC_MINH')),
  confirmed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create table public.players (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  user_id       uuid not null,
  display_name  text not null check (char_length(display_name) between 1 and 30),
  recovery_code text not null,
  task_id       int references public.tasks(id),
  hint_text     text,
  joined_at     timestamptz not null default now(),
  unique (room_id, user_id)
);
create unique index players_room_name_uq on public.players (room_id, lower(display_name));
create index players_room_idx on public.players (room_id);

create table public.submissions (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms(id) on delete cascade,
  player_id        uuid not null unique references public.players(id) on delete cascade,
  task_id          int  not null references public.tasks(id),
  answer           jsonb not null,
  first_answer     jsonb not null,
  first_is_correct boolean not null,
  is_correct       boolean not null,
  details          jsonb not null,
  revision_count   int not null default 0,
  submitted_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index submissions_room_idx on public.submissions (room_id);

-- ---------- QUYỀN TRUY CẬP BẢNG ----------
revoke all on public.tasks, public.task_answers, public.rooms, public.players, public.submissions
  from public, anon, authenticated;
grant select on public.rooms, public.players, public.submissions to authenticated;  -- chỉ để Realtime hoạt động

alter table public.tasks        enable row level security;  -- không policy: không ai đọc trực tiếp
alter table public.task_answers enable row level security;  -- không policy: không ai đọc trực tiếp
alter table public.rooms        enable row level security;
alter table public.players      enable row level security;
alter table public.submissions  enable row level security;

-- Hàm hỗ trợ cho policy (SECURITY DEFINER để tránh đệ quy RLS)
create function public.is_room_teacher(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rooms where id = p_room and teacher_id = auth.uid());
$$;
create function public.is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.players where room_id = p_room and user_id = auth.uid());
$$;

create policy rooms_select on public.rooms for select to authenticated
  using (teacher_id = auth.uid() or public.is_room_member(id));
create policy players_select on public.players for select to authenticated
  using (user_id = auth.uid() or public.is_room_teacher(room_id));
create policy submissions_select on public.submissions for select to authenticated
  using (public.is_room_teacher(room_id));
-- Không có policy INSERT/UPDATE/DELETE: mọi thay đổi đi qua hàm RPC bên dưới.

-- ---------- HÀM NỘI BỘ ----------
create function public.iso(ts timestamptz) returns text
language sql immutable set search_path = public as $$
  select to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;

-- Quy đổi cách ghi nhóm sang số nhóm hiện đại 1-18 (IA=1, IIA=2, IIIA=13, ... VIIIA=18)
create function public.normalize_group(p text) returns int
language plpgsql immutable set search_path = public as $$
declare s text := upper(regexp_replace(coalesce(p, ''), '[\s\-\.]', '', 'g'));
begin
  if s ~ '^[0-9]{1,2}$' then
    if s::int between 1 and 18 then return s::int; end if;
    return null;
  end if;
  return case s
    when 'IA' then 1     when '1A' then 1
    when 'IIA' then 2    when '2A' then 2
    when 'IIIA' then 13  when '3A' then 13
    when 'IVA' then 14   when '4A' then 14
    when 'VA' then 15    when '5A' then 15
    when 'VIA' then 16   when '6A' then 16
    when 'VIIA' then 17  when '7A' then 17
    when 'VIIIA' then 18 when '8A' then 18
    else null end;
end $$;

-- Chấm một bài: đúng khi MỌI phần bắt buộc của nhiệm vụ đều đúng
create function public.grade_answer(p_task int, p_answer jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a task_answers%rowtype;
  t_fields text[];
  f text; v text; r boolean;
  ok boolean := true;
  d jsonb := '{}'::jsonb;
begin
  select * into a from task_answers where task_id = p_task;
  select fields into t_fields from tasks where id = p_task;
  foreach f in array t_fields loop
    v := nullif(btrim(coalesce(p_answer ->> f, '')), '');
    r := case f
      when 'element' then v = a.symbol
      when 'cell'    then v = a.symbol
      when 'z'       then case when v ~ '^[0-9]{1,3}$' then v::int = a.z else false end
      when 'period'  then case when v ~ '^[0-9]{1,2}$' then v::int = a.period else false end
      when 'group'   then public.normalize_group(v) = a.grp
      when 'block'   then lower(v) = a.block
      else false end;
    r := coalesce(r, false);
    d := d || jsonb_build_object(f, r);
    ok := ok and r;
  end loop;
  return jsonb_build_object('correct', ok, 'details', d);
end $$;

-- Tự chuyển giai đoạn khi hết giờ (idempotent, dựa trên đồng hồ máy chủ)
create function public.advance_if_due(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; n int := 0;
begin
  select * into r from rooms where id = p_room;
  if not found or r.phase not in ('briefing', 'working', 'review')
     or r.phase_ends_at is null or now() < r.phase_ends_at then
    return;
  end if;
  select * into r from rooms where id = p_room for update;
  while r.phase in ('briefing', 'working', 'review') and now() >= r.phase_ends_at and n < 4 loop
    n := n + 1;
    if r.phase = 'briefing' then
      r.phase := 'working'; r.phase_ends_at := r.phase_ends_at + interval '180 seconds';
    elsif r.phase = 'working' then
      r.phase := 'review';  r.phase_ends_at := r.phase_ends_at + interval '90 seconds';
      r.review_edit_open := false;
    else
      r.phase := 'confirm'; r.phase_ends_at := r.phase_ends_at + interval '60 seconds';
      r.review_edit_open := false;
    end if;
  end loop;
  update rooms set phase = r.phase, phase_ends_at = r.phase_ends_at,
                   review_edit_open = r.review_edit_open where id = p_room;
end $$;

-- Tải phòng + kiểm tra quyền giáo viên (+ khóa hàng nếu cần)
create function public.load_teacher_room(p_code text, p_lock boolean) returns public.rooms
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into r from rooms where code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'room_not_found'; end if;
  if r.teacher_id <> auth.uid() then raise exception 'forbidden'; end if;
  perform advance_if_due(r.id);
  if p_lock then
    select * into r from rooms where id = r.id for update;
  else
    select * into r from rooms where id = r.id;
  end if;
  return r;
end $$;

create function public.room_summary(p_room uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int; v_sub int; v_ok int; v_need int;
begin
  select count(*) into v_n from players where room_id = p_room;
  select count(*), count(*) filter (where is_correct) into v_sub, v_ok
    from submissions where room_id = p_room;
  v_need := ceil(0.7 * v_n);   -- numeric chính xác, không sai số số thực
  return jsonb_build_object(
    'participants', v_n, 'submitted', v_sub, 'correct', v_ok, 'needed', v_need,
    'rate', case when v_n > 0 then round(100.0 * v_ok / v_n, 1) else 0 end,
    'status', case when v_n > 0 and v_ok >= v_need then 'DAT' else 'CHO_XAC_MINH' end);
end $$;

-- ---------- HÀM RPC CHO GIÁO VIÊN ----------
create function public.create_room() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_code text; i int;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into rooms (code, teacher_id) values (v_code, auth.uid());
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  return jsonb_build_object('code', v_code);
end $$;

create function public.start_game(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; v_n int;
begin
  r := public.load_teacher_room(p_code, true);
  if r.status <> 'open' then raise exception 'room_closed'; end if;
  if r.phase <> 'lobby' then raise exception 'already_started'; end if;
  select count(*) into v_n from players where room_id = r.id;
  if v_n = 0 then raise exception 'no_players'; end if;

  -- mỗi học sinh một nhiệm vụ khác nhau (tối đa 10 người = 10 nhiệm vụ)
  with sp as (select id, row_number() over (order by random()) rn from players where room_id = r.id),
       st as (select id, row_number() over (order by random()) rn from tasks)
  update players p set task_id = st.id
    from sp join st on st.rn = sp.rn where p.id = sp.id;

  update rooms set phase = 'briefing', started_at = now(),
                   phase_ends_at = now() + interval '30 seconds' where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

create function public.advance_phase(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  r := public.load_teacher_room(p_code, true);
  if r.status <> 'open' then raise exception 'room_closed'; end if;
  if r.phase = 'briefing' then
    update rooms set phase = 'working', phase_ends_at = now() + interval '180 seconds' where id = r.id;
  elsif r.phase = 'working' then
    update rooms set phase = 'review', phase_ends_at = now() + interval '90 seconds',
                     review_edit_open = false where id = r.id;
  elsif r.phase = 'review' then
    update rooms set phase = 'confirm', phase_ends_at = now() + interval '60 seconds',
                     review_edit_open = false where id = r.id;
  elsif r.phase = 'confirm' then
    raise exception 'use_confirm';
  else
    raise exception 'wrong_phase';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Quyền hỗ trợ: đúng 1 lần / phòng, chỉ trong giai đoạn kiểm tra.
-- Chỉ gửi gợi ý (văn bản) cho người đã nộp nhưng chưa đúng; KHÔNG tự chọn đáp án.
create function public.activate_hint(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; v_n int;
begin
  r := public.load_teacher_room(p_code, true);
  if r.phase <> 'review' then raise exception 'wrong_phase'; end if;
  if r.hint_used then raise exception 'hint_already_used'; end if;
  update players p set hint_text = ta.hint
    from submissions s join task_answers ta on ta.task_id = s.task_id
    where s.player_id = p.id and s.is_correct = false and p.room_id = r.id;
  get diagnostics v_n = row_count;
  update rooms set hint_used = true, hint_used_at = now(), review_edit_open = true where id = r.id;
  return jsonb_build_object('ok', true, 'hinted', v_n);
end $$;

create function public.set_edit_open(p_code text, p_open boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  r := public.load_teacher_room(p_code, true);
  if r.phase <> 'review' then raise exception 'wrong_phase'; end if;
  update rooms set review_edit_open = coalesce(p_open, false) where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

create function public.publish_results(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  r := public.load_teacher_room(p_code, true);
  if r.phase not in ('review', 'confirm', 'finished') then raise exception 'wrong_phase'; end if;
  update rooms set results_visible = true where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

create function public.confirm_room(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; v_sum jsonb;
begin
  r := public.load_teacher_room(p_code, true);
  if r.phase <> 'confirm' then raise exception 'wrong_phase'; end if;
  v_sum := public.room_summary(r.id);
  update rooms set phase = 'finished', phase_ends_at = null, review_edit_open = false,
                   results_visible = true, final_status = v_sum ->> 'status',
                   confirmed_at = now() where id = r.id;
  return v_sum;
end $$;

create function public.close_room(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  r := public.load_teacher_room(p_code, true);
  if r.phase not in ('lobby', 'finished') then raise exception 'wrong_phase'; end if;
  update rooms set status = 'closed', phase = 'finished', phase_ends_at = null where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

create function public.get_solutions(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; v_rows jsonb;
begin
  r := public.load_teacher_room(p_code, false);
  if r.phase not in ('review', 'confirm', 'finished') then raise exception 'wrong_phase'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'player_id', p.id, 'display_name', p.display_name, 'task_id', t.id,
      'title', t.title, 'fact', t.fact,
      'expected', jsonb_build_object('symbol', a.symbol, 'name', a.element_name, 'z', a.z,
                                     'period', a.period, 'group', a.grp, 'block', a.block),
      'explanation', a.explanation, 'answer', s.answer, 'is_correct', s.is_correct
    ) order by t.id), '[]'::jsonb)
  into v_rows
  from players p
  join tasks t on t.id = p.task_id
  join task_answers a on a.task_id = t.id
  left join submissions s on s.player_id = p.id
  where p.room_id = r.id;
  return v_rows;
end $$;

-- ---------- HÀM RPC CHO HỌC SINH ----------
create function public.join_room(p_code text, p_name text, p_recovery text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype; pl players%rowtype; v_name text; v_n int; v_rec text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_name := btrim(coalesce(p_name, ''));
  select * into r from rooms where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.status <> 'open' then raise exception 'room_closed'; end if;
  if r.teacher_id = auth.uid() then raise exception 'forbidden'; end if;

  -- đã ở trong phòng (tải lại trang): vào lại bình thường
  select * into pl from players where room_id = r.id and user_id = auth.uid();
  if found then return jsonb_build_object('code', r.code); end if;

  if length(v_name) < 1 or length(v_name) > 30 then raise exception 'invalid_name'; end if;

  -- khôi phục bằng tên + mã khôi phục (đổi thiết bị / mất phiên)
  if nullif(btrim(coalesce(p_recovery, '')), '') is not null then
    select * into pl from players
      where room_id = r.id and lower(display_name) = lower(v_name)
        and recovery_code = upper(btrim(p_recovery));
    if not found then raise exception 'invalid_recovery'; end if;
    update players set user_id = auth.uid() where id = pl.id;
    return jsonb_build_object('code', r.code);
  end if;

  if r.phase <> 'lobby' then raise exception 'room_started'; end if;
  select count(*) into v_n from players where room_id = r.id;
  if v_n >= 10 then raise exception 'room_full'; end if;

  v_rec := upper(substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 5));
  begin
    insert into players (room_id, user_id, display_name, recovery_code)
    values (r.id, auth.uid(), v_name, v_rec);
  exception when unique_violation then
    raise exception 'name_taken';
  end;
  return jsonb_build_object('code', r.code);
end $$;

create function public.submit_answer(p_code text, p_answer jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r rooms%rowtype; pl players%rowtype; s submissions%rowtype;
  v_ans jsonb; v_g jsonb; v_found boolean; v_ok boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_answer is null or jsonb_typeof(p_answer) <> 'object' then raise exception 'invalid_answer'; end if;
  select * into r from rooms where code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'room_not_found'; end if;
  perform advance_if_due(r.id);
  select * into r from rooms where id = r.id for share;          -- chặn đổi giai đoạn giữa chừng
  select * into pl from players where room_id = r.id and user_id = auth.uid() for update;  -- tuần tự hóa yêu cầu của cùng một người
  if not found then raise exception 'not_in_room'; end if;
  if pl.task_id is null then raise exception 'no_task'; end if;

  v_ans := jsonb_build_object(
    'element', left(btrim(coalesce(p_answer ->> 'element', '')), 3),
    'cell',    left(btrim(coalesce(p_answer ->> 'cell', '')), 3),
    'z',       left(btrim(coalesce(p_answer ->> 'z', '')), 3),
    'period',  left(btrim(coalesce(p_answer ->> 'period', '')), 2),
    'group',   left(btrim(coalesce(p_answer ->> 'group', '')), 8),
    'block',   left(btrim(coalesce(p_answer ->> 'block', '')), 1));
  v_g  := grade_answer(pl.task_id, v_ans);
  v_ok := (v_g ->> 'correct')::boolean;

  select * into s from submissions where player_id = pl.id;
  v_found := found;

  if r.phase = 'working' and now() < r.phase_ends_at then
    if v_found then
      update submissions set answer = v_ans, first_answer = v_ans, first_is_correct = v_ok,
             is_correct = v_ok, details = v_g -> 'details', updated_at = now() where id = s.id;
    else
      insert into submissions (room_id, player_id, task_id, answer, first_answer,
                               first_is_correct, is_correct, details)
      values (r.id, pl.id, pl.task_id, v_ans, v_ans, v_ok, v_ok, v_g -> 'details');
    end if;
  elsif r.phase = 'review' and now() < r.phase_ends_at then
    if not v_found then raise exception 'first_submit_locked'; end if;
    if not r.review_edit_open then raise exception 'edit_not_allowed'; end if;
    update submissions set answer = v_ans, is_correct = v_ok, details = v_g -> 'details',
           revision_count = revision_count + 1, updated_at = now() where id = s.id;
  else
    raise exception 'phase_locked';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- TRẠNG THÁI PHÒNG (dùng chung cho giáo viên và học sinh) ----------
create function public.get_state(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r rooms%rowtype; pl players%rowtype; s submissions%rowtype;
  v_teacher boolean; v_member boolean; v_has_sub boolean;
  v_count int; v_room jsonb; v_res jsonb; v_players jsonb; v_task jsonb; v_sub jsonb; v_sum jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into r from rooms where code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'room_not_found'; end if;
  v_teacher := (r.teacher_id = auth.uid());
  select * into pl from players where room_id = r.id and user_id = auth.uid();
  v_member := found;
  if not v_teacher and not v_member then raise exception 'not_in_room'; end if;

  perform advance_if_due(r.id);
  select * into r from rooms where id = r.id;
  select count(*) into v_count from players where room_id = r.id;

  v_room := jsonb_build_object(
    'id', r.id, 'code', r.code, 'status', r.status, 'phase', r.phase,
    'phase_ends_at', iso(r.phase_ends_at), 'started_at', iso(r.started_at),
    'review_edit_open', r.review_edit_open, 'hint_used', r.hint_used,
    'results_visible', r.results_visible, 'final_status', r.final_status,
    'player_count', v_count);
  v_res := jsonb_build_object('server_now', iso(now()), 'room', v_room);

  if v_teacher then
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'display_name', p.display_name, 'task_id', p.task_id,
        'recovery_code', p.recovery_code, 'submitted', s2.id is not null,
        'is_correct', case when r.phase in ('review', 'confirm', 'finished') then s2.is_correct end,
        'first_is_correct', case when r.phase in ('review', 'confirm', 'finished') then s2.first_is_correct end,
        'revision_count', coalesce(s2.revision_count, 0),
        'has_hint', p.hint_text is not null) order by p.joined_at), '[]'::jsonb)
      into v_players
      from players p left join submissions s2 on s2.player_id = p.id
      where p.room_id = r.id;
    v_sum := room_summary(r.id);
    if r.phase in ('lobby', 'briefing', 'working') then   -- không lộ điểm khi đang làm bài
      v_sum := v_sum || jsonb_build_object('correct', null, 'rate', null, 'status', null);
    end if;
    return v_res || jsonb_build_object('role', 'teacher', 'players', v_players, 'summary', v_sum);
  end if;

  -- học sinh
  if r.phase not in ('lobby', 'briefing') and pl.task_id is not null then
    select jsonb_build_object('id', t.id, 'title', t.title, 'kind', t.kind, 'fact', t.fact,
                              'prompt', t.prompt, 'fields', to_jsonb(t.fields),
                              'options', to_jsonb(t.options))
      into v_task from tasks t where t.id = pl.task_id;
  end if;
  select * into s from submissions where player_id = pl.id;
  v_has_sub := found;
  if v_has_sub then
    v_sub := jsonb_build_object('answer', s.answer, 'submitted_at', iso(s.submitted_at),
                                'revision_count', s.revision_count);
    if r.results_visible then
      v_sub := v_sub || jsonb_build_object('is_correct', s.is_correct, 'details', s.details);
    end if;
  end if;
  return v_res || jsonb_build_object('role', 'player',
    'me', jsonb_build_object('id', pl.id, 'display_name', pl.display_name,
                             'recovery_code', pl.recovery_code, 'hint', pl.hint_text),
    'task', v_task, 'submission', v_sub);
end $$;

-- ---------- PHÂN QUYỀN THỰC THI ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_room(),
  public.join_room(text, text, text),
  public.get_state(text),
  public.start_game(text),
  public.advance_phase(text),
  public.activate_hint(text),
  public.set_edit_open(text, boolean),
  public.publish_results(text),
  public.confirm_room(text),
  public.close_room(text),
  public.submit_answer(text, jsonb),
  public.get_solutions(text)
to authenticated;
-- is_room_teacher / is_room_member cần cho policy RLS của người dùng
grant execute on function public.is_room_teacher(uuid), public.is_room_member(uuid) to authenticated;

-- ---------- REALTIME ----------
alter publication supabase_realtime add table public.rooms, public.players, public.submissions;
