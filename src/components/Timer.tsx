export default function Timer({ remaining, total }: { remaining: number | null; total?: number }) {
  if (remaining === null) return null;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const pct = total ? Math.min(100, Math.max(0, (remaining / total) * 100)) : 0;
  return (
    <div className="timer" role="timer" aria-label={`Còn lại ${remaining} giây`}>
      <span className={`timer-digits${remaining <= 10 ? ' low' : ''}`}>
        {mm}:{ss}
      </span>
      {total ? (
        <div className="bar">
          <div style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}
