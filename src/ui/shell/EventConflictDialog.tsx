import { useState } from 'react'
import { useAppState, eventDiffFields, type EventDiffField } from '../../state'
import { formatTimeRange } from '../list/timeText'
import { useFocusTrap } from './useFocusTrap'
import type { EventRecord, Id } from '../../domain/model'

export interface EventConflictItem {
  incoming: EventRecord
  existing: EventRecord
}

const FIELD_LABEL: Record<EventDiffField, string> = {
  time: '时间',
  note: '备注',
  tags: '标签',
  links: '关联',
}

export function EventConflictDialog({
  title,
  conflicts,
  onResolve,
  onCancel,
}: {
  title: string
  conflicts: EventConflictItem[]
  onResolve: (choices: Record<Id, 'overwrite' | 'skip'>) => void
  onCancel: () => void
}) {
  const state = useAppState()
  const ref = useFocusTrap<HTMLDivElement>(true, onCancel)
  const [choices, setChoices] = useState<Record<Id, 'overwrite' | 'skip'>>(
    () => Object.fromEntries(conflicts.map((c) => [c.incoming.id, 'skip' as const])),
  )
  const setAll = (v: 'overwrite' | 'skip') =>
    setChoices(Object.fromEntries(conflicts.map((c) => [c.incoming.id, v])))

  const tagNames = (ids: Id[]) =>
    ids.map((id) => state.tags.find((t) => t.id === id)?.name).filter(Boolean).join('、') || '—'
  const linkTitles = (ids: Id[]) =>
    ids.map((id) => state.events.find((e) => e.id === id)?.title).filter(Boolean).join('、') || '—'
  const fieldValue = (e: EventRecord, f: EventDiffField): string => {
    if (f === 'time') return formatTimeRange(e.start, e.end, state.nowYear)
    if (f === 'note') return e.note || '—'
    if (f === 'tags') return tagNames(e.tagIds)
    return linkTitles(e.links)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="info-card conflict-card" ref={ref} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}>
        <div className="logo display">{title}</div>
        <p>目标文件夹已存在同名事件，请选择如何处理：</p>
        <div className="conflict-bulk">
          <button type="button" onClick={() => setAll('overwrite')}>全部覆盖</button>
          <button type="button" onClick={() => setAll('skip')}>全部跳过</button>
        </div>
        <ul className="conflict-list">
          {conflicts.map(({ incoming, existing }) => {
            const fields = eventDiffFields(incoming, existing)
            return (
              <li key={incoming.id} className="conflict-item">
                <div className="conflict-title">{incoming.title}</div>
                <table className="conflict-diff">
                  <thead>
                    <tr><th></th><th>现有</th><th>待写入</th></tr>
                  </thead>
                  <tbody>
                    {fields.map((f) => (
                      <tr key={f}>
                        <td>{FIELD_LABEL[f]}</td>
                        <td>{fieldValue(existing, f)}</td>
                        <td>{fieldValue(incoming, f)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="conflict-choice" role="radiogroup" aria-label={`处理「${incoming.title}」`}>
                  <label>
                    <input type="radio" name={`c-${incoming.id}`} checked={choices[incoming.id] === 'overwrite'}
                      onChange={() => setChoices((c) => ({ ...c, [incoming.id]: 'overwrite' }))} />
                    覆盖
                  </label>
                  <label>
                    <input type="radio" name={`c-${incoming.id}`} checked={choices[incoming.id] === 'skip'}
                      onChange={() => setChoices((c) => ({ ...c, [incoming.id]: 'skip' }))} />
                    跳过
                  </label>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="conflict-actions">
          <button type="button" onClick={onCancel}>取消</button>
          <button type="button" className="primary" onClick={() => onResolve(choices)}>确认</button>
        </div>
      </div>
    </div>
  )
}
