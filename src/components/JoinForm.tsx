import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage, joinRoom } from '../lib/api';
import { notify } from './Toaster';

interface Props {
  initialCode?: string;
  lockCode?: boolean;
  onJoined: (code: string) => void;
}

export default function JoinForm({ initialCode = '', lockCode = false, onJoined }: Props) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [recovery, setRecovery] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      notify('Hãy nhập mã phòng.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await joinRoom(c, name, showRecovery ? recovery : null);
      notify('Đã vào phòng.', 'ok');
      onJoined(res.code);
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Mã phòng
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
          readOnly={lockCode}
          autoCapitalize="characters"
          placeholder="VD: K7M2QX"
        />
      </label>
      <label>
        Tên hoặc mã điều tra viên
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="VD: Minh An" />
      </label>
      {showRecovery && (
        <label>
          Mã khôi phục (đã hiện ở lần vào trước)
          <input value={recovery} onChange={(e) => setRecovery(e.target.value.toUpperCase())} maxLength={8} />
        </label>
      )}
      <button type="button" className="link" onClick={() => setShowRecovery(!showRecovery)}>
        {showRecovery ? 'Tôi vào lần đầu' : 'Tôi đã vào phòng này trước đó (đổi thiết bị)'}
      </button>
      <button className="btn primary" disabled={busy || name.trim().length === 0}>
        {busy ? 'Đang vào phòng…' : 'Vào phòng'}
      </button>
    </form>
  );
}
