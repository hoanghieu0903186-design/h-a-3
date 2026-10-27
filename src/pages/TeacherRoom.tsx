import { useState } from 'react';
import StatusBar from '../components/StatusBar';
import Timer from '../components/Timer';
import { notify } from '../components/Toaster';
import { useRoomState } from '../hooks/useRoomState';
import {
  activateHint, advancePhase, closeRoom, confirmRoom, errorMessage, getSolutions,
  publishResults, setEditOpen, startGame,
} from '../lib/api';
import { PHASE_LABEL, PHASE_SECONDS, STATUS_LABEL, groupLabel } from '../lib/format';
import type { Navigate, SolutionRow } from '../lib/types';

const ADVANCE_LABEL: Record<string, string> = {
  briefing: 'Bỏ qua hướng dẫn, bắt đầu làm bài',
  working: 'Chuyển sang giai đoạn kiểm tra',
  review: 'Chuyển sang xác nhận kết quả',
};

export default function TeacherRoom({ code, navigate }: { code: string; navigate: Navigate }) {
  const { state, fatal, warning, loading, realtimeOk, remainingSec, refresh } = useRoomState(code);
  const [busy, setBusy] = useState(false);
  const [solutions, setSolutions] = useState<SolutionRow[] | null>(null);

  const link = `${window.location.origin}/?room=${code}`;

  async function run(action: () => Promise<unknown>, okMsg?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      if (okMsg) notify(okMsg, 'ok');
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      await refresh();
      setBusy(false);
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      notify('Đã sao chép đường link.', 'ok');
    } catch {
      notify(`Hãy sao chép thủ công: ${link}`, 'info');
    }
  };

  const showSolutions = async () => {
    try {
      setSolutions(await getSolutions(code));
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
  };

  if (fatal) {
    return (
      <section className="card narrow">
        <h2>Không mở được phòng</h2>
        <p>{fatal === 'room_not_found' ? `Không tìm thấy phòng ${code}.` : 'Bạn chưa tham gia phòng này.'}</p>
        <button className="btn" onClick={() => navigate('/')}>Về trang chủ</button>
      </section>
    );
  }
  if (loading || !state) {
    return (
      <>
        <StatusBar warning={warning} realtimeOk={realtimeOk} />
        <div className="center muted">Đang tải phòng…</div>
      </>
    );
  }
  if (state.role !== 'teacher') {
    return (
      <section className="card narrow">
        <h2>Bạn không phải giáo viên của phòng này</h2>
        <button className="btn" onClick={() => navigate(`/play/${code}`)}>Vào với tư cách học sinh</button>
      </section>
    );
  }

  const room = state.room;
  const phase = room.phase;
  const players = state.players ?? [];
  const summary = state.summary;
  const afterWork = phase === 'review' || phase === 'confirm' || phase === 'finished';
  const closed = room.status === 'closed';

  return (
    <>
      <StatusBar warning={warning} realtimeOk={realtimeOk} />

      <section className="card room-head teacher-head">
        <div>
          <div className="muted">Mã phòng</div>
          <div className="room-code">{room.code}</div>
        </div>
        <div className="share">
          <div className="muted">Đường link cho học sinh</div>
          <div className="share-row">
            <code>{link}</code>
            <button className="btn" onClick={copy}>Sao chép</button>
          </div>
        </div>
        <div className="phase-badge">{closed ? 'Phòng đã đóng' : PHASE_LABEL[phase]}</div>
        {phase in PHASE_SECONDS && <Timer remaining={remainingSec} total={PHASE_SECONDS[phase]} />}
      </section>

      {!closed && (
        <section className="card controls">
          <h2>Điều khiển phòng</h2>
          <div className="btn-row">
            {phase === 'lobby' && (
              <button className="btn primary big" disabled={busy || room.player_count === 0}
                onClick={() => run(() => startGame(code), 'Đã bắt đầu trò chơi.')}>
                Bắt đầu trò chơi ({room.player_count} người)
              </button>
            )}
            {ADVANCE_LABEL[phase] && (
              <button className="btn" disabled={busy} onClick={() => run(() => advancePhase(code))}>
                {ADVANCE_LABEL[phase]}
              </button>
            )}
            {phase === 'review' && (
              <>
                <button className="btn" disabled={busy || room.hint_used}
                  onClick={() => run(async () => {
                    const r = await activateHint(code);
                    notify(`Đã gửi gợi ý cho ${r.hinted} học sinh chưa đúng.`, 'ok');
                  })}>
                  {room.hint_used ? 'Quyền hỗ trợ: đã dùng' : 'Kích hoạt quyền hỗ trợ (1 lần)'}
                </button>
                <button className="btn" disabled={busy}
                  onClick={() => run(() => setEditOpen(code, !room.review_edit_open))}>
                  {room.review_edit_open ? 'Đóng quyền sửa bài' : 'Cho phép sửa bài'}
                </button>
              </>
            )}
            {afterWork && !room.results_visible && (
              <button className="btn" disabled={busy}
                onClick={() => run(() => publishResults(code), 'Đã công bố kết quả cho học sinh.')}>
                Công bố kết quả cho học sinh
              </button>
            )}
            {afterWork && (
              <button className="btn" onClick={showSolutions}>Xem đáp án và lời giải</button>
            )}
            {phase === 'confirm' && (
              <button className="btn primary" disabled={busy}
                onClick={() => {
                  if (window.confirm('Xác nhận kết quả cuối cùng của phòng?')) {
                    run(() => confirmRoom(code), 'Đã xác nhận kết quả.');
                  }
                }}>
                Xác nhận kết quả cuối cùng
              </button>
            )}
            {(phase === 'finished' || phase === 'lobby') && (
              <button className="btn" disabled={busy}
                onClick={() => {
                  if (window.confirm('Đóng phòng? Sau khi đóng sẽ không ai vào thêm được.')) {
                    run(() => closeRoom(code), 'Đã đóng phòng.');
                  }
                }}>
                Đóng phòng
              </button>
            )}
          </div>
          <p className="muted">
            Quyền hỗ trợ: {room.hint_used ? 'đã sử dụng' : 'chưa sử dụng'} · Sửa bài:{' '}
            {room.review_edit_open ? 'đang mở' : 'đang khóa'} · Công bố kết quả: {room.results_visible ? 'đã công bố' : 'chưa'}
          </p>
        </section>
      )}

      <section className="card">
        <h2>Điều tra viên ({players.length}/10)</h2>
        {players.length === 0 ? (
          <p className="muted">Chưa có ai vào phòng. Hãy gửi mã phòng hoặc đường link cho học sinh.</p>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Hồ sơ</th>
                  <th>Nộp bài</th>
                  {afterWork && <th>Kết quả</th>}
                  {afterWork && <th>Lần đầu</th>}
                  <th>Số lần sửa</th>
                  <th>Mã khôi phục</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td>{p.display_name}</td>
                    <td>{p.task_id ?? '—'}</td>
                    <td>{p.submitted ? 'Đã nộp' : 'Chưa nộp'}</td>
                    {afterWork && (
                      <td>{p.is_correct === null ? '—' : p.is_correct ? <span className="flag ok">Đúng</span> : <span className="flag bad">Sai</span>}</td>
                    )}
                    {afterWork && (
                      <td>{p.first_is_correct === null ? '—' : p.first_is_correct ? 'Đúng' : 'Sai'}</td>
                    )}
                    <td>{p.revision_count}</td>
                    <td><code>{p.recovery_code}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {summary && phase !== 'lobby' && (
        <section className="card">
          <h2>Tổng hợp kết quả</h2>
          <div className="stats">
            <div><span>Số người tham gia</span><strong>{summary.participants}</strong></div>
            <div><span>Số người đã nộp</span><strong>{summary.submitted}</strong></div>
            <div><span>Số người đúng</span><strong>{summary.correct ?? '—'}</strong></div>
            <div><span>Cần đạt tối thiểu</span><strong>{summary.needed}</strong></div>
            <div><span>Tỉ lệ hoàn thành</span><strong>{summary.rate === null ? '—' : `${summary.rate}%`}</strong></div>
          </div>
          {summary.status && (
            <div className={`result ${summary.status === 'DAT' ? 'ok' : 'warn'}`}>
              <strong>
                {room.final_status ? 'Kết quả cuối cùng' : 'Tạm tính'}: {STATUS_LABEL[room.final_status ?? summary.status]}
              </strong>
            </div>
          )}
        </section>
      )}

      {solutions && (
        <section className="card">
          <div className="between">
            <h2>Đáp án và lời giải</h2>
            <button className="btn" onClick={() => setSolutions(null)}>Ẩn</button>
          </div>
          {solutions.map((s) => (
            <article key={s.player_id} className="solution">
              <h3>{s.title} · {s.display_name}</h3>
              <p><strong>Dữ kiện:</strong> {s.fact}</p>
              <p>
                <strong>Đáp án:</strong> {s.expected.name} ({s.expected.symbol}), Z = {s.expected.z}, chu kỳ {s.expected.period},
                nhóm {groupLabel(s.expected.group)}, khối {s.expected.block}.
              </p>
              <p className="muted">{s.explanation}</p>
              <p>
                <strong>Bài làm:</strong>{' '}
                {s.answer
                  ? `thẻ ${s.answer.element || '—'}, ô ${s.answer.cell || '—'}, Z ${s.answer.z || '—'}, chu kỳ ${s.answer.period || '—'}, nhóm ${s.answer.group || '—'}, khối ${s.answer.block || '—'}`
                  : 'chưa nộp'}
              </p>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
