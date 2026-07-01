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
