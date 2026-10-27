import { useState } from 'react';
import JoinForm from '../components/JoinForm';
import { notify } from '../components/Toaster';
import { createRoom, errorMessage, getState } from '../lib/api';
import type { Navigate } from '../lib/types';

export default function Home({ navigate, initialRoom }: { navigate: Navigate; initialRoom: string }) {
  const [busy, setBusy] = useState(false);
  const [reopen, setReopen] = useState('');

  const create = async () => {
    setBusy(true);
    try {
      const { code } = await createRoom();
      navigate(`/teacher/${code}`);
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    const code = reopen.trim().toUpperCase();
    if (!code) return;
    try {
      const s = await getState(code);
      navigate(s.role === 'teacher' ? `/teacher/${code}` : `/play/${code}`);
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
  };

  return (
    <div className="home">
      <section className="hero">
        <h1>Giải mã bản đồ nguyên tố</h1>
        <p>
          Cục Điều tra Nguyên tố cần bạn. Mỗi điều tra viên nhận một hồ sơ bí mật, phân tích dữ kiện và xác định vị
          trí nguyên tố trong bảng tuần hoàn. Cả đội có 6 phút.
        </p>
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Tôi là học sinh</h2>
          <JoinForm initialCode={initialRoom} onJoined={(code) => navigate(`/play/${code}`)} />
        </section>

        <section className="card">
          <h2>Tôi là giáo viên</h2>
          <p className="muted">Tạo phòng, gửi mã hoặc đường link cho học sinh (tối đa 10 người).</p>
          <button className="btn primary" onClick={create} disabled={busy}>
            {busy ? 'Đang tạo phòng…' : 'Tạo phòng mới'}
          </button>
          <div className="divider" />
          <label className="inline-form">
            Mở lại phòng đã tạo
            <span>
              <input
                value={reopen}
                onChange={(e) => setReopen(e.target.value.toUpperCase())}
                placeholder="Mã phòng"
                maxLength={8}
              />
              <button className="btn" onClick={open} disabled={!reopen.trim()}>
                Mở
              </button>
            </span>
          </label>
        </section>
      </div>
    </div>
  );
}
