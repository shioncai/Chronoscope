import type { EventRecord, Category, Tag, Id } from '../domain/model'
import type { Clock } from '../data'

interface StoreData {
  events: EventRecord[]
  categories: Category[]
  tags: Tag[]
}

export interface RestorePlan {
  categories: Category[]
  tags: Tag[]
  events: EventRecord[]
}

// A LIVE category with `name` directly under `parentId` in the working tree.
export function findLiveCat(work: Category[], name: string, parentId: Id | null): Category | undefined {
  return work.find((c) => !c.deleted && c.name === name && c.parentId === parentId)
}
export function findLiveTag(work: Tag[], name: string): Tag | undefined {
  return work.find((t) => !t.deleted && t.name === name)
}
// Order for a new sibling under `parentId`: append after existing live siblings.
export function nextOrder(work: Category[], parentId: Id | null): number {
  return work.filter((c) => !c.deleted && c.parentId === parentId).reduce((m, c) => Math.max(m, c.order), -1) + 1
}

// Resolve one restored event's folder chain against the live working tree.
// Reuse a live same-name/same-path folder (its color wins), else revive the
// original (deleted) local folder re-parented under the resolved parent.
function resolveRestoreCategory(
  localId: Id | null,
  allCatsById: Map<Id, Category>,
  work: Category[],
  out: Category[],
  memo: Map<Id, Id>,
  clock: Clock,
): Id | null {
  if (localId == null) return null
  const cached = memo.get(localId)
  if (cached !== undefined) return cached
  const orig = allCatsById.get(localId)
  if (!orig) return null
  const parentId = resolveRestoreCategory(orig.parentId, allCatsById, work, out, memo, clock)
  const match = findLiveCat(work, orig.name, parentId)
  let resolved: Id
  if (match) {
    resolved = match.id
  } else {
    const revived: Category = { ...orig, parentId, deleted: false, updatedAt: clock.now() }
    work.push(revived)
    out.push(revived)
    resolved = revived.id
  }
  memo.set(localId, resolved)
  return resolved
}

function resolveRestoreTag(
  localId: Id,
  allTagsById: Map<Id, Tag>,
  work: Tag[],
  out: Tag[],
  clock: Clock,
): Id {
  const orig = allTagsById.get(localId)
  if (!orig) return localId
  const match = findLiveTag(work, orig.name)
  if (match) return match.id
  const revived: Tag = { ...orig, deleted: false, updatedAt: clock.now() }
  work.push(revived)
  out.push(revived)
  return revived.id
}

export function planRestore(current: StoreData, ids: Id[], clock: Clock): RestorePlan {
  const idSet = new Set(ids)
  const allCatsById = new Map(current.categories.map((c) => [c.id, c]))
  const allTagsById = new Map(current.tags.map((t) => [t.id, t]))
  const catWork = current.categories.filter((c) => !c.deleted).map((c) => ({ ...c }))
  const tagWork = current.tags.filter((t) => !t.deleted).map((t) => ({ ...t }))
  const outCats: Category[] = []
  const outTags: Tag[] = []
  const catMemo = new Map<Id, Id>()

  const events: EventRecord[] = []
  for (const e of current.events) {
    if (!e.deleted || !idSet.has(e.id)) continue
    const categoryId = resolveRestoreCategory(e.categoryId, allCatsById, catWork, outCats, catMemo, clock)
    const tagIds = e.tagIds.map((t) => resolveRestoreTag(t, allTagsById, tagWork, outTags, clock))
    events.push({ ...e, categoryId, tagIds, deleted: false, updatedAt: clock.now() })
  }
  return { categories: outCats, tags: outTags, events }
}
