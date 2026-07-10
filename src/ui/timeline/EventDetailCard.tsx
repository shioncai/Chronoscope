// src/ui/timeline/EventDetailCard.tsx
import { Markdown } from '../features/markdown/Markdown'
import type { EventCardData } from './card'
import type { Id } from '../../domain/model'
import { useT } from '../../i18n/useT'

export interface EventDetailCardProps {
  data: EventCardData
  onEdit: () => void
  onClose: () => void
  onSelectLink: (id: Id) => void
}

export function EventDetailCard({ data, onEdit, onClose, onSelectLink }: EventDetailCardProps) {
  const t = useT()
  return (
    <div className="event-card" role="dialog" aria-label={t('card.detail')}>
      <header>
        <h3 className="display">{data.title}</h3>
        <button type="button" aria-label={t('common.close')} onClick={onClose}>
          ✕
        </button>
      </header>
      <p className="mono time">{data.timeLabel}</p>
      {data.categoryName && <p className="category">{data.categoryName}</p>}
      {data.tagNames.length > 0 && (
        <ul className="tags">
          {data.tagNames.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      {data.note && <Markdown source={data.note} />}
      {data.links.length > 0 && (
        <ul className="links">
          {data.links.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => onSelectLink(l.id)}>
                {l.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button type="button" onClick={onEdit}>
          {t('common.edit')}
        </button>
      </div>
    </div>
  )
}
