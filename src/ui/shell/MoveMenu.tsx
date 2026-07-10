import type { Category, Id } from '../../domain/model'
import { useT } from '../../i18n/useT'

export interface MoveMenuProps {
  targets: { category: Category; depth: number }[]
  onMove: (parentId: Id | null) => void
  topLabel?: string
}

export function MoveMenu({ targets, onMove, topLabel = '顶级' }: MoveMenuProps) {
  const t = useT()
  return (
    <div className="move-menu" role="menu">
      <button type="button" role="menuitem" onClick={() => onMove(null)}>
        {topLabel}
      </button>
      {targets.map((target) => (
        <button key={target.category.id} type="button" role="menuitem" onClick={() => onMove(target.category.id)}>
          {'　'.repeat(target.depth) + t('common.quote', { name: target.category.name })}
        </button>
      ))}
    </div>
  )
}
