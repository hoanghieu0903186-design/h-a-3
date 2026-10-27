import type { ReactNode } from 'react';
import { ELEMENT_BY_SYMBOL } from '../data/elements';
import type { Answer, FieldKey, TaskInfo } from '../lib/types';

interface Props {
  task: TaskInfo;
  draft: Answer;
  setDraft: (a: Answer) => void;
  editable: boolean;
  details?: Partial<Record<FieldKey, boolean>>;
}

const LABELS: Record<FieldKey, string> = {
  element: 'Nguyên tố (chọn một thẻ)',
  cell: 'Vị trí trên bảng tuần hoàn',
  z: 'Số hiệu nguyên tử Z',
  period: 'Chu kỳ',
  group: 'Nhóm (VD: 16 hoặc VIA)',
  block: 'Khối',
};

function Row({ field, details, children }: { field: FieldKey; details?: Props['details']; children: ReactNode }) {
  const verdict = details ? details[field] : undefined;
  return (
    <div className="field-row">
      <div className="field-label">
        {LABELS[field]}
        {verdict !== undefined && (
          <span className={`flag ${verdict ? 'ok' : 'bad'}`}>{verdict ? '✓ Đúng' : '✗ Sai'}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function TaskForm({ task, draft, setDraft, editable, details }: Props) {
  const set = (patch: Partial<Answer>) => setDraft({ ...draft, ...patch });
  const options = [...task.options].sort((a, b) => a.localeCompare(b));

  return (
    <div className="task-form">
      {task.fields.map((f) => {
        if (f === 'element') {
          return (
            <Row key={f} field={f} details={details}>
              <div className="opt-cards">
                {options.map((s) => {
                  const el = ELEMENT_BY_SYMBOL[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`opt-card${draft.element === s ? ' selected' : ''}`}
                      disabled={!editable}
                      aria-pressed={draft.element === s}
                      onClick={() => set({ element: s })}
                    >
                      <span className="sym">{s}</span>
                      <span className="nm">{el ? el.name : ''}</span>
                    </button>
                  );
                })}
              </div>
            </Row>
          );
        }
        if (f === 'cell') {
          return (
            <Row key={f} field={f} details={details}>
              <div className="cell-pick">
                {draft.cell ? (
                  <>
                    Ô đã chọn: <strong>{draft.cell}</strong>
                  </>
                ) : (
                  'Chạm vào một ô trên bảng tuần hoàn bên dưới.'
                )}
              </div>
            </Row>
          );
        }
        if (f === 'z') {
          return (
            <Row key={f} field={f} details={details}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={118}
                value={draft.z ?? ''}
                disabled={!editable}
                onChange={(e) => set({ z: e.target.value })}
              />
            </Row>
          );
        }
        if (f === 'period') {
          return (
            <Row key={f} field={f} details={details}>
              <select value={draft.period ?? ''} disabled={!editable} onChange={(e) => set({ period: e.target.value })}>
                <option value="">— chọn —</option>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={String(n)}>
                    Chu kỳ {n}
                  </option>
                ))}
              </select>
            </Row>
          );
        }
        if (f === 'group') {
          return (
            <Row key={f} field={f} details={details}>
              <input
                value={draft.group ?? ''}
                maxLength={8}
                disabled={!editable}
                placeholder="VD: 16 hoặc VIA"
                onChange={(e) => set({ group: e.target.value })}
              />
            </Row>
          );
        }
        return (
          <Row key={f} field={f} details={details}>
            <select value={draft.block ?? ''} disabled={!editable} onChange={(e) => set({ block: e.target.value })}>
              <option value="">— chọn —</option>
              <option value="s">Khối s</option>
              <option value="p">Khối p</option>
              <option value="d">Khối d</option>
              <option value="f">Khối f</option>
            </select>
          </Row>
        );
      })}
    </div>
  );
}
