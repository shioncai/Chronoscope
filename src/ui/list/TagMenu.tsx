import type { Tag, Id } from '../../domain/model'

export interface TagMenuProps {
  tags: Tag[]
  onPick: (tagId: Id) => void
  emptyLabel?: string
}

// A small popover list of tags. Shares the .move-menu look; shows a plain
// placeholder (not a button) when there is nothing to pick.
export function TagMenu({ tags, onPick, emptyLabel = '' }: TagMenuProps) {
  return (
    <div className="tag-menu move-menu" role="menu">
      {tags.length === 0 ? (
        <span className="empty">{emptyLabel}</span>
      ) : (
        tags.map((t) => (
          <button key={t.id} type="button" role="menuitem" onClick={() => onPick(t.id)}>
            {t.name}
          </button>
        ))
      )}
    </div>
  )
}
