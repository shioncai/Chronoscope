import type { Category, Id } from '../domain/model'
import { descendantCategoryIds } from './selectors'

// Returns the categories that need to be written back (the dragged category plus any
// reordered siblings under the target parent). An illegal move returns [].
export function reorderedCategories(
  categories: Category[],
  id: Id,
  newParentId: Id | null,
  beforeId: Id | null,
): Category[] {
  if (newParentId === id) return []
  if (newParentId !== null && descendantCategoryIds(categories, id).has(newParentId)) return []

  const live = categories.filter((c) => !c.deleted)
  const dragged = live.find((c) => c.id === id)
  if (!dragged) return []

  // Existing children of the target parent (excluding the dragged item), sorted by order.
  const siblings = live
    .filter((c) => c.parentId === newParentId && c.id !== id)
    .sort((a, b) => a.order - b.order)

  const insertAt = beforeId === null ? siblings.length : siblings.findIndex((c) => c.id === beforeId)
  const next = [...siblings]
  next.splice(insertAt < 0 ? siblings.length : insertAt, 0, { ...dragged, parentId: newParentId })

  const changed: Category[] = []
  next.forEach((c, order) => {
    const original = categories.find((o) => o.id === c.id)!
    if (original.parentId !== newParentId || original.order !== order) {
      changed.push({ ...original, parentId: newParentId, order })
    }
  })
  return changed
}

// Maps a drop position (target row + zone) to a (parentId, beforeId) target for
// reorderedCategories. The dragged item is excluded from sibling lookups so that
// dropping in the "after" zone of the row directly above the dragged item can never
// resolve beforeId to the dragged item's own id.
export function computeDropTarget(
  categories: Category[],
  dragId: Id,
  targetId: Id,
  mode: 'before' | 'after' | 'into',
): { parentId: Id | null; beforeId: Id | null } {
  const live = categories.filter((c) => !c.deleted)
  const target = live.find((c) => c.id === targetId)
  if (!target) return { parentId: null, beforeId: null }
  if (mode === 'into') return { parentId: targetId, beforeId: null }
  if (mode === 'before') return { parentId: target.parentId, beforeId: targetId }
  // after: land after the target at sibling level — exclude the dragged item so
  // beforeId can never point at the thing being moved.
  const sibs = live
    .filter((c) => c.parentId === target.parentId && c.id !== dragId)
    .sort((a, b) => a.order - b.order)
  const i = sibs.findIndex((c) => c.id === targetId)
  const after = sibs[i + 1]
  return { parentId: target.parentId, beforeId: after ? after.id : null }
}
