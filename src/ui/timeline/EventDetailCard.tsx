import { Markdown } from '../markdown/Markdown'
import type { EventCardData } from './card'
import type { Id } from '../../domain/model'
import { Icon } from '../components/Icon'
import { useT } from '../../i18n/useT'

export interface EventDetailCardProps {
  data: EventCardData
  onEdit: () => void
  onClose: () => void
  onSelectLink: (id: Id) => void
  onDuplicate?: () => void
  onDelete?: () => void
  onRestore?: () => void
}

export function EventDetailCard({ data, onEdit, onClose, onSelectLink, onDuplicate, onDelete, onRestore }: EventDetailCardProps) {
  const t = useT()
  return (
    <div className="event-card" role="dialog" aria-label={t('card.detail')}>
      <header className="event-card-head">
        <h3>{data.title}</h3>
        <button type="button" className="icon-btn icon-btn--sm" aria-label={t('common.close')} onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <p className="event-card-time mono">{data.timeLabel}</p>
      {(data.duration || data.relative) && (
        <p className="event-card-meta">
          {data.relative}
          {data.duration && data.relative && ' · '}
          {data.duration && t('card.lasted', { d: data.duration })}
        </p>
      )}
      {data.categoryName && (
        <p className="event-card-folder">
          <span className="cell-dot" style={{ background: data.categoryColor ?? undefined }} aria-hidden="true" />
          {data.categoryPath.join(' / ')}
        </p>
      )}
      {data.tagNames.length > 0 && (
        <ul className="event-card-tags">
          {data.tagNames.map((tag) => <li key={tag}># {tag}</li>)}
        </ul>
      )}
      {data.note && <div className="event-card-note"><Markdown source={data.note} /></div>}
      {data.links.length > 0 && (
        <div className="event-card-links">
          <span className="sec-label">{t('card.links')}</span>
          <ul>
            {data.links.map((l) => (
              <li key={l.id}>
                <button type="button" className="link-btn" onClick={() => onSelectLink(l.id)}>
                  <Icon name="link" size={13} />
                  {l.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="event-card-actions">
        {data.deleted ? (
          onRestore && (
            <button type="button" className="btn btn-sm btn-primary" onClick={onRestore}>
              <Icon name="restore" size={14} />
              <span>{t('common.restore')}</span>
            </button>
          )
        ) : (
          <button type="button" className="btn btn-sm btn-primary" onClick={onEdit}>
            <Icon name="edit" size={14} />
            <span>{t('common.edit')}</span>
          </button>
        )}
        {!data.deleted && onDuplicate && (
          <button type="button" className="btn btn-sm" onClick={onDuplicate}>
            <Icon name="copy" size={14} />
            <span>{t('editor.duplicate')}</span>
          </button>
        )}
        {!data.deleted && onDelete && (
          <button type="button" className="icon-btn icon-btn--sm is-danger" aria-label={t('common.delete')} title={`${t('common.delete')} (Del)`} onClick={onDelete}>
            <Icon name="trash" size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
