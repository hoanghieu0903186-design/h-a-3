import { useEffect, useState } from 'react';
import JoinForm from '../components/JoinForm';
import PeriodicTable from '../components/PeriodicTable';
import StatusBar from '../components/StatusBar';
import TaskForm from '../components/TaskForm';
import Timer from '../components/Timer';
import { notify } from '../components/Toaster';
import { useRoomState } from '../hooks/useRoomState';
import { errorMessage, submitAnswer } from '../lib/api';
import { PHASE_LABEL, PHASE_SECONDS, STATUS_LABEL, formatTime } from '../lib/format';
import type { Answer, Navigate } from '../lib/types';

const draftKey = (code: string) => `gmbnt:draft:${code}`;

export default function StudentRoom({ code, navigate }: { code: string; navigate: Navigate }) {
  const { state, fatal, warning, loading, realtimeOk, remainingSec, refresh } = useRoomState(code);
  const [draft, setDraft] = useState<Answer>(() => {
    try {
      const raw = localStorage.getItem(draftKey(code));
      return raw ? (JSON.parse(raw) as Answer) : {};
    } catch {
      return {};
    }
  });
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Khôi phục bài đã nộp từ máy chủ sau khi tải lại trang
  useEffect(() => {
    if (!state || hydrated) return;
    if (state.submission) setDraft(state.submission.answer);
    setHydrated(true);
  }, [state, hydrated]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(code), JSON.stringify(draft));
    } catch {
      /* bỏ qua nếu trình duyệt chặn localStorage */
    }
  }, [code, draft]);

  if (fatal === 'not_in_room') {
    return (
      <section className="card narrow">
        <h2>Tham gia phòng {code}</h2>
        <JoinForm initialCode={code} lockCode onJoined={() => refresh()} />
      </section>
    );
  }
  if (fatal) {
    return (
      <section className="card narrow">
        <h2>Không vào được phòng</h2>
        <p>Không tìm thấy phòng với mã {code}. Hãy kiểm tra lại mã phòng.</p>
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
  if (state.role === 'teacher') {
    return (
      <section className="card narrow">
        <h2>Bạn là giáo viên của phòng này</h2>
        <button className="btn primary" onClick={() => navigate(`/teacher/${code}`)}>Mở bảng điều khiển</button>
      </section>
    );
  }

  const { room, me, task, submission } = state;
  const phase = room.phase;
  const timeLeft = remainingSec ?? 0;
  const editable =
    (phase === 'working' && timeLeft > 0) ||
    (phase === 'review' && room.review_edit_open && !!submission && timeLeft > 0);

  const submit = async () => {
    if (!task) return;
    const missing = task.fields.filter((f) => !(draft[f] ?? '').toString().trim());
    if (missing.length > 0) {
      notify('Hãy hoàn thành tất cả các phần của hồ sơ trước khi nộp.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await submitAnswer(code, draft);
      notify(phase === 'review' ? 'Đã lưu bài sửa.' : 'Đã nộp bài.', 'ok');
      await refresh();
    } catch (e) {
      notify(errorMessage(e), 'error');
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <StatusBar warning={warning} realtimeOk={realtimeOk} />
      <div className="room-head card">
        <div>
          <div className="muted">Phòng {room.code}</div>
          <strong>{me?.display_name}</strong>
        </div>
        <div className="phase-badge">{PHASE_LABEL[phase]}</div>
        {phase in PHASE_SECONDS && <Timer remaining={remainingSec} total={PHASE_SECONDS[phase]} />}
      </div>

      {phase === 'lobby' && (
        <section className="card">
          <h2>Đã vào phòng. Chờ giáo viên bắt đầu…</h2>
          <p>Hiện có {room.player_count}/10 điều tra viên trong phòng.</p>
          <p className="muted">
            Mã khôi phục của bạn: <strong className="code-chip">{me?.recovery_code}</strong>. Hãy ghi lại để vào lại
            phòng nếu đổi thiết bị.
          </p>
        </section>
      )}

      {phase === 'briefing' && (
        <section className="card">
          <h2>Hướng dẫn nhiệm vụ</h2>
          <ol className="steps">
            <li>Mỗi điều tra viên nhận một hồ sơ riêng khi giai đoạn làm bài bắt đầu.</li>
            <li>Đọc dữ kiện (số hiệu nguyên tử Z hoặc cấu hình electron) và chọn đúng thẻ nguyên tố.</li>
            <li>Chạm vào ô của nguyên tố trên bảng tuần hoàn, rồi điền chu kỳ, nhóm và các phần còn lại.</li>
            <li>Nhấn “Nộp bài”. Bạn có 180 giây. Hồ sơ chỉ được tính khi mọi phần đều đúng.</li>
            <li>Nhóm có thể ghi theo số (1–18) hoặc theo nhóm A (VD: VIA = 16).</li>
          </ol>
        </section>
      )}

      {phase !== 'lobby' && phase !== 'briefing' && task && (
        <>
          <section className="card task-card">
            <h2>{task.title}</h2>
            <div className="fact">{task.fact}</div>
            <p>{task.prompt}</p>
          </section>

          {me?.hint && (
            <section className="card hint">
              <strong>Gợi ý từ trung tâm:</strong> {me.hint}
            </section>
          )}

          <div className="work-grid">
            <section className="card">
              <TaskForm
                task={task}
                draft={draft}
                setDraft={setDraft}
                editable={editable}
                details={room.results_visible ? submission?.details : undefined}
              />
              {editable ? (
                <button className="btn primary big" onClick={submit} disabled={submitting}>
                  {submitting ? 'Đang gửi…' : submission ? 'Nộp lại bài đã sửa' : 'Nộp bài'}
                </button>
              ) : (
                <div className="muted">
                  {phase === 'working' && 'Đã hết thời gian làm bài.'}
                  {phase === 'review' &&
                    (submission
                      ? room.review_edit_open
                        ? 'Đã hết thời gian sửa bài.'
                        : 'Đang chờ giáo viên kiểm tra. Chưa được sửa bài.'
                      : 'Bạn chưa nộp bài trong thời gian làm bài.')}
                  {(phase === 'confirm' || phase === 'finished') && 'Bài làm đã được khóa.'}
                </div>
              )}
              {submission && (
                <p className="muted">
                  Đã nộp lúc {formatTime(submission.submitted_at)}
                  {submission.revision_count > 0 ? ` · đã sửa ${submission.revision_count} lần` : ''}.
                </p>
              )}
              {!submission && phase === 'working' && <p className="muted">Bạn chưa nộp bài.</p>}
            </section>

            <section className="card">
              <PeriodicTable
                selected={draft.cell}
                disabled={!editable}
                onSelect={(s) => setDraft({ ...draft, cell: s })}
              />
            </section>
          </div>
        </>
      )}

      {room.results_visible && phase !== 'lobby' && phase !== 'briefing' && (
        <section className={`card result ${submission?.is_correct ? 'ok' : 'bad'}`}>
          {!submission && <strong>Bạn chưa nộp bài nên hồ sơ chưa được tính.</strong>}
          {submission && submission.is_correct && <strong>✓ Hồ sơ của bạn chính xác. Bạn đã hoàn thành nhiệm vụ.</strong>}
          {submission && submission.is_correct === false && (
            <strong>✗ Hồ sơ chưa chính xác. Xem các phần được đánh dấu sai ở trên.</strong>
          )}
        </section>
      )}

      {room.final_status && (
        <section className={`card result ${room.final_status === 'DAT' ? 'ok' : 'warn'}`}>
          <strong>Kết quả của phòng: {STATUS_LABEL[room.final_status]}</strong>
        </section>
      )}
      {room.status === 'closed' && <div className="center muted">Phòng đã đóng.</div>}
    </>
  );
}
