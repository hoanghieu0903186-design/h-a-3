import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ApiError, errorMessage, getState } from '../lib/api';
import type { RoomState } from '../lib/types';

const FATAL = new Set(['room_not_found', 'not_in_room']);
const ACTIVE = ['briefing', 'working', 'review'];

/**
 * Lấy trạng thái phòng từ máy chủ (RPC get_state), cập nhật bằng Supabase Realtime,
 * kèm polling dự phòng. Đồng hồ luôn tính theo giờ máy chủ.
 */
export function useRoomState(code: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const s = await getState(code);
      setState(s);
      setOffset(Date.parse(s.server_now) - Date.now());
      setWarning(null);
      setFatal(null);
    } catch (e) {
      const raw = e instanceof ApiError ? e.code : '';
      if (FATAL.has(raw)) setFatal(raw);
      else setWarning(errorMessage(e));
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [code]);

  const phase = state?.room.phase;
  const roomId = state?.room.id;
  const role = state?.role;

  useEffect(() => {
    refresh();
  }, [refresh]);

  // polling dự phòng
  useEffect(() => {
    if (fatal) return;
    const ms = phase && ACTIVE.includes(phase) ? 3000 : 5000;
    const id = setInterval(refresh, ms);
    return () => clearInterval(id);
  }, [refresh, phase, fatal]);

  // nhịp cập nhật đồng hồ hiển thị
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // quay lại tab / có mạng trở lại
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onOnline = () => refresh();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // Realtime
  useEffect(() => {
    if (!roomId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refresh();
      }, 250);
    };
    let channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, schedule);
    if (role === 'teacher') {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions', filter: `room_id=eq.${roomId}` },
        schedule,
      );
    }
    channel.subscribe((status) => {
      setRealtimeOk(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED') refresh();
    });
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [roomId, role, refresh]);

  const endsAt = state?.room.phase_ends_at ? Date.parse(state.room.phase_ends_at) : null;
  const remainingSec = endsAt === null ? null : Math.max(0, Math.ceil((endsAt - (now + offset)) / 1000));

  // hết giờ: hỏi lại máy chủ để chuyển giai đoạn
  useEffect(() => {
    if (remainingSec === 0 && phase && ACTIVE.includes(phase)) {
      const t = setTimeout(refresh, 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [remainingSec, phase, endsAt, refresh]);

  return { state, fatal, warning, loading, realtimeOk, remainingSec, refresh };
}
