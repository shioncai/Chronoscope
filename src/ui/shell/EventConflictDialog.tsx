import { useState } from 'react'
import { useAppState, eventDiffFields, type EventDiffField } from '../../state'
import { formatTimeRange } from '../list/timeText'
import { useFocusTrap } from './useFocusTrap'
import { useT, useLocale } from '../../i18n/useT'
import type { MessageKey } from '../../i18n/catalog'
import type { EventRecord, Id } from '../../domain/model'

export interface EventConflictItem {
  incoming: EventRecord
  existing: EventRecord
}

const FIELD_LABEL: Record<EventDiffField, MessageKey> = {
  time: 'conflict.field.time',
  note: 'conflict.field.note',
  tags: 'conflict.field.tags',
  links: 'conflict.field.links',
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
  const t = useT()
  const locale = useLocale()
  const ref = useFocusTrap<HTMLDivElement>(true, onCancel)
  const [choices, setChoices] = useState<Record<Id, 'overwrite' | 'skip'>>(
    () => Object.fromEntries(conflicts.map((c) => [c.incoming.id, 'skip' as const])),
  )
  const setAll = (v: 'overwrite' | 'skip') =>
    setChoices(Object.fromEntries(conflicts.map((c) => [c.incoming.id, v])))

  const tagNames = (ids: Id[]) =>
    ids.map((id) => state.tags.find((t) => t.id === id)?.name).filter(Boolean).join(t('common.listSeparator')) || '—'
  const linkTitles = (ids: Id[]) =>
    ids.map((id) => state.events.find((e) => e.id === id)?.title).filter(Boolean).join(t('common.listSeparator')) || '—'
  const fieldValue = (e: EventRecord, f: EventDiffField): string => {
    if (f === 'time') return formatTimeRange(e.start, e.end, locale)
    if (f === 'note') return e.note || '—'
    if (f === 'tags') return tagNames(e.tagIds)
    return linkTitles(e.links)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="info-card conflict-card" ref={ref} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}>
        <div className="logo display">{title}</div>
        <p>{t('conflict.prompt')}</p>
        <div className="conflict-bulk">
          <button type="button" onClick={() => setAll('overwrite')}>{t('conflict.overwriteAll')}</button>
          <button type="button" onClick={() => setAll('skip')}>{t('conflict.skipAll')}</button>
        </div>
        <ul className="conflict-list">
          {conflicts.map(({ incoming, existing }) => {
            const fields = eventDiffFields(incoming, existing)
            return (
              <li key={incoming.id} className="conflict-item">
                <div className="conflict-title">{incoming.title}</div>
                <table className="conflict-diff">
                  <thead>
                    <tr><th></th><th>{t('conflict.existing')}</th><th>{t('conflict.incoming')}</th></tr>
                  </thead>
                  <tbody>
                    {fields.map((f) => (
                      <tr key={f}>
                        <td>{t(FIELD_LABEL[f])}</td>
                        <td>{fieldValue(existing, f)}</td>
                        <td>{fieldValue(incoming, f)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="conflict-choice" role="radiogroup" aria-label={t('conflict.handle', { title: incoming.title })}>
                  <label>
                    <input type="radio" name={`c-${incoming.id}`} checked={choices[incoming.id] === 'overwrite'}
                      onChange={() => setChoices((c) => ({ ...c, [incoming.id]: 'overwrite' }))} />
                    {t('common.overwrite')}
                  </label>
                  <label>
                    <input type="radio" name={`c-${incoming.id}`} checked={choices[incoming.id] === 'skip'}
                      onChange={() => setChoices((c) => ({ ...c, [incoming.id]: 'skip' }))} />
                    {t('common.skip')}
                  </label>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="conflict-actions">
          <button type="button" onClick={onCancel}>{t('common.cancel')}</button>
          <button type="button" className="primary" onClick={() => onResolve(choices)}>{t('common.confirm')}</button>
        </div>
      </div>
    </div>
  )
}
