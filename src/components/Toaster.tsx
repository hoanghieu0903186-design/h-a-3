import { useEffect, useState } from 'react';

type Kind = 'ok' | 'error' | 'info';
interface ToastItem {
  id: number;
  msg: string;
  kind: Kind;
}

let listeners: Array<(t: ToastItem) => void> = [];
let counter = 0;

export function notify(msg: string, kind: Kind = 'info'): void {
  const t: ToastItem = { id: ++counter, msg, kind };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const l = (t: ToastItem) => {
      setItems((p) => [...p, t]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== t.id)), 4000);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);
  return (
    <div className="toaster" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
