import { ELEMENTS } from '../data/elements';

interface Props {
  selected?: string;
  onSelect: (symbol: string) => void;
  disabled?: boolean;
}

export default function PeriodicTable({ selected, onSelect, disabled }: Props) {
  const groups = Array.from({ length: 18 }, (_, i) => i + 1);
  return (
    <div className="pt-wrap">
      <div className="pt" role="group" aria-label="Bảng tuần hoàn từ H đến Ca">
        <div className="pt-corner" style={{ gridRow: 1, gridColumn: 1 }} />
        {groups.map((g) => (
          <div key={g} className="pt-head" style={{ gridRow: 1, gridColumn: g + 1 }}>
            {g}
          </div>
        ))}
        {[1, 2, 3, 4].map((p) => (
          <div key={p} className="pt-period" style={{ gridRow: p + 1, gridColumn: 1 }}>
            {p}
          </div>
        ))}
        <div className="pt-gap" style={{ gridRow: 5, gridColumn: '4 / span 10' }}>
          Khối d: Sc → Zn (Z = 21–30)
        </div>
        {ELEMENTS.map((e) => (
          <button
            key={e.symbol}
            type="button"
            className={`pt-cell block-${e.block}${selected === e.symbol ? ' selected' : ''}`}
            style={{ gridRow: e.period + 1, gridColumn: e.group + 1 }}
            disabled={disabled}
            aria-pressed={selected === e.symbol}
            aria-label={`${e.name}, số hiệu ${e.z}`}
            onClick={() => onSelect(e.symbol)}
          >
            <span className="z">{e.z}</span>
            <span className="sym">{e.symbol}</span>
            <span className="nm">{e.name}</span>
          </button>
        ))}
      </div>
      <div className="legend">
        <span><i className="sw block-s" /> Khối s</span>
        <span><i className="sw block-p" /> Khối p</span>
        <span><i className="sw block-d" /> Khối d</span>
        <span className="muted">Hàng ngang: chu kỳ 1–4 · Cột: nhóm 1–18 · He thuộc khối s</span>
      </div>
    </div>
  );
}
