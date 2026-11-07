import { useMemo, useState } from 'react'
import type { EventRecord, Id } from '../../domain/model'
import { Icon } from '../components/Icon'
import { useT } from '../../i18n/useT'

const SHOWN = 60

/** Pick the events this one links to: linked first, then a searchable rest —
 *  the full list is unusable past a few dozen events. */
export function LinkPicker({ events, selfId, value, onChange }: {
  events: EventRecord[]
  selfId: Id | null
  value: Id[]
  onChange: (ids: Id[]) => void
}) {
  const t = useT()
  const [q, setQ] = useState('')
  const candidates = useMemo(() => events.filter((e) => !e.deleted && e.id !== selfId), [events, selfId])
  const chosen = new Set(value)
  const needle = q.trim().toLowerCase()
  const matches = candidates.filter((e) => !needle || e.title.toLowerCase().includes(needle))
  const ordered = [...matches.filter((e) => chosen.has(e.id)), ...matches.filter((e) => !chosen.has(e.id))]
  const toggle = (id: Id) => onChange(chosen.has(id) ? value.filter((x) => x !== id) : [...value, id])

  if (candidates.length === 0) return <p className="faint">{t('editor.noLinkCandidates')}</p>
  return (
    <div className="link-picker">
      {candidates.length > 8 && (
        <div className="link-search">
          <Icon name="search" size={14} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('editor.linkSearch')}
            aria-label={t('editor.linkSearch')} />
        </div>
      )}
      <div className="link-list">
        {ordered.slice(0, SHOWN).map((e) => (
          <label key={e.id} className="link-item">
            <input type="checkbox" checked={chosen.has(e.id)} onChange={() => toggle(e.id)} />
            <span>{e.title}</span>
          </label>
        ))}
        {ordered.length > SHOWN && <p className="faint link-more">{t('editor.linkMore', { n: ordered.length - SHOWN })}</p>}
        {ordered.length === 0 && <p className="faint">{t('editor.linkNone')}</p>}
      </div>
    </div>
  )
}
