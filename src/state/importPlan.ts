import { validateEvent, type EventRecord, type Category, type Tag, type Id } from '../domain/model'
import type { Clock } from '../data'
import { liveEventAt, eventKey } from './identity'

interface StoreData {
  events: EventRecord[]
  categories: Category[]
  tags: Tag[]
}

export interface RestoreConflict {
  eventId: Id
  existingId: Id
}
export interface RestorePlan {
  categories: Category[]
  tags: Tag[]
  events: EventRecord[]
  conflicts: RestoreConflict[]
  purge: Id[] // existing live events overwritten by a restore → permanently removed
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

export function planRestore(
  current: StoreData,
  ids: Id[],
  clock: Clock,
  resolutions: Record<Id, 'overwrite' | 'skip'> = {},
): RestorePlan {
  const idSet = new Set(ids)
  const allCatsById = new Map(current.categories.map((c) => [c.id, c]))
  const allTagsById = new Map(current.tags.map((t) => [t.id, t]))
  const catWork = current.categories.filter((c) => !c.deleted).map((c) => ({ ...c }))
  const tagWork = current.tags.filter((t) => !t.deleted).map((t) => ({ ...t }))
  const outCats: Category[] = []
  const outTags: Tag[] = []
  const catMemo = new Map<Id, Id>()
  const liveEvents = current.events.filter((e) => !e.deleted)

  const events: EventRecord[] = []
  const conflicts: RestoreConflict[] = []
  const purge: Id[] = []
  const superseded = new Set<Id>()
  const claimed = new Set<string>() // (folder,title) already restored in this batch

  for (const e of current.events) {
    if (!e.deleted || !idSet.has(e.id)) continue
    const categoryId = resolveRestoreCategory(e.categoryId, allCatsById, catWork, outCats, catMemo, clock)
    const key = `${categoryId ?? ''}::${eventKey(e.title)}`
    if (claimed.has(key)) continue // another restored event already took this slot
    const x = liveEventAt(liveEvents, e.title, categoryId)
    if (x && !superseded.has(x.id)) {
      const decision = resolutions[e.id]
      if (decision === undefined) {
        conflicts.push({ eventId: e.id, existingId: x.id })
        continue
      }
      if (decision === 'skip') continue
      // 'overwrite': the restored event wins completely; the existing live
      // same-title event is permanently removed (not sent to the recycle bin).
      superseded.add(x.id)
      purge.push(x.id)
    }
    const tagIds = e.tagIds.map((t) => resolveRestoreTag(t, allTagsById, tagWork, outTags, clock))
    events.push({ ...e, categoryId, tagIds, deleted: false, updatedAt: clock.now() })
    claimed.add(key)
  }
  return { categories: outCats, tags: outTags, events, conflicts, purge }
}

export interface ImportSummary {
  addedEvents: number
  overwrittenEvents: number
  unchangedEvents: number
  invalidEvents: number
  addedCategories: number
  reusedCategories: number
  addedTags: number
  reusedTags: number
}
export interface ImportResult {
  categories: Category[]
  tags: Tag[]
  events: EventRecord[]
  summary: ImportSummary
}

// Resolve a FILE category id to a local id. Match existing LIVE folders by
// name+path (existing color wins), else create a new folder with the file's
// color. Memoized per file id; recurses up the file parent chain.
function resolveImportCategory(
  fileId: Id | null,
  fileCatsById: Map<Id, Category>,
  work: Category[],
  out: Category[],
  memo: Map<Id, Id>,
  counters: { added: number; reused: number },
  clock: Clock,
  genId: () => string,
): Id | null {
  if (fileId == null) return null
  const cached = memo.get(fileId)
  if (cached !== undefined) return cached
  const fc = fileCatsById.get(fileId)
  if (!fc) return null // dangling parent reference → treat as root
  const parentId = resolveImportCategory(fc.parentId, fileCatsById, work, out, memo, counters, clock, genId)
  const match = findLiveCat(work, fc.name, parentId)
  let resolved: Id
  if (match) {
    resolved = match.id
    counters.reused++
  } else {
    const created: Category = {
      id: genId(),
      name: fc.name,
      parentId,
      color: fc.color,
      order: nextOrder(work, parentId),
      updatedAt: clock.now(),
      deleted: false,
    }
    work.push(created)
    out.push(created)
    resolved = created.id
    counters.added++
  }
  memo.set(fileId, resolved)
  return resolved
}

// Resolve a FILE tag id to a local id (flat; match live by name, else create).
function resolveImportTag(
  fileId: Id,
  fileTagsById: Map<Id, Tag>,
  work: Tag[],
  out: Tag[],
  memo: Map<Id, Id>,
  counters: { added: number; reused: number },
  clock: Clock,
  genId: () => string,
): Id | undefined {
  const cached = memo.get(fileId)
  if (cached !== undefined) return cached
  const ft = fileTagsById.get(fileId)
  if (!ft) return undefined
  const match = findLiveTag(work, ft.name)
  let resolved: Id
  if (match) {
    resolved = match.id
    counters.reused++
  } else {
    const created: Tag = { id: genId(), name: ft.name, color: ft.color, updatedAt: clock.now(), deleted: false }
    work.push(created)
    out.push(created)
    resolved = created.id
    counters.added++
  }
  memo.set(fileId, resolved)
  return resolved
}

function sameAttrs(a: EventRecord, b: EventRecord): boolean {
  const set = (xs: Id[]) => JSON.stringify([...xs].sort())
  return (
    a.title === b.title &&
    a.categoryId === b.categoryId &&
    (a.note ?? '') === (b.note ?? '') &&
    JSON.stringify(a.start ?? null) === JSON.stringify(b.start ?? null) &&
    JSON.stringify(a.end ?? null) === JSON.stringify(b.end ?? null) &&
    set(a.tagIds) === set(b.tagIds) &&
    set(a.links) === set(b.links)
  )
}

export function planImport(current: StoreData, incoming: StoreData, clock: Clock, genId: () => string): ImportResult {
  const fileCatsById = new Map(incoming.categories.map((c) => [c.id, c]))
  const fileTagsById = new Map(incoming.tags.map((t) => [t.id, t]))

  const catWork = current.categories.filter((c) => !c.deleted).map((c) => ({ ...c }))
  const tagWork = current.tags.filter((t) => !t.deleted).map((t) => ({ ...t }))
  const outCats: Category[] = []
  const outTags: Tag[] = []
  const catMemo = new Map<Id, Id>()
  const tagMemo = new Map<Id, Id>()
  const catCounters = { added: 0, reused: 0 }
  const tagCounters = { added: 0, reused: 0 }

  // Pre-resolve ALL file folders and tags so empty folders / unused tags survive.
  for (const c of incoming.categories) {
    resolveImportCategory(c.id, fileCatsById, catWork, outCats, catMemo, catCounters, clock, genId)
  }
  for (const t of incoming.tags) {
    resolveImportTag(t.id, fileTagsById, tagWork, outTags, tagMemo, tagCounters, clock, genId)
  }

  // ---- events (identity = title + resolved folder) ----
  const liveEvents = current.events.filter((e) => !e.deleted)
  const liveById = new Map(liveEvents.map((e) => [e.id, e]))
  const folderOf = (fe: EventRecord): Id | null =>
    fe.categoryId != null ? (catMemo.get(fe.categoryId) ?? null) : null

  let invalidEvents = 0
  const valid = incoming.events.filter((fe) => {
    if (validateEvent(fe).ok) return true
    invalidEvents++
    return false
  })

  // Pass 1: assign each file event a local id — an existing live match (overwrite)
  // or a fresh id (create). File events sharing (folder, title) collapse to one.
  const eventIdMap = new Map<Id, Id>() // fileEventId -> localId
  const slot = new Map<string, Id>() // `${folderId}::${title}` -> localId
  for (const fe of valid) {
    const folderId = folderOf(fe)
    const key = `${folderId ?? ''}::${eventKey(fe.title)}`
    let localId = slot.get(key)
    if (localId === undefined) {
      const match = liveEventAt(liveEvents, fe.title, folderId)
      localId = match ? match.id : genId()
      slot.set(key, localId)
    }
    eventIdMap.set(fe.id, localId)
  }

  // Pass 2: build records with links remapped through eventIdMap.
  const outByLocalId = new Map<Id, EventRecord>()
  let addedEvents = 0
  let overwrittenEvents = 0
  let unchangedEvents = 0
  for (const fe of valid) {
    const localId = eventIdMap.get(fe.id)!
    const folderId = folderOf(fe)
    const tagIds = [...new Set(fe.tagIds.map((t) => tagMemo.get(t)).filter((x): x is Id => x != null))]
    const links = [...new Set(fe.links.map((l) => eventIdMap.get(l)).filter((x): x is Id => x != null))]
    const existing = liveById.get(localId)
    if (existing) {
      const next: EventRecord = {
        ...existing,
        title: fe.title,
        start: fe.start,
        end: fe.end,
        note: fe.note ?? '',
        categoryId: folderId,
        tagIds,
        links,
        updatedAt: clock.now(),
        deleted: false,
      }
      if (sameAttrs(existing, next)) {
        unchangedEvents++
        continue
      }
      if (!outByLocalId.has(localId)) overwrittenEvents++
      outByLocalId.set(localId, next)
    } else {
      const next: EventRecord = {
        id: localId,
        title: fe.title,
        start: fe.start,
        end: fe.end,
        note: fe.note ?? '',
        categoryId: folderId,
        tagIds,
        links,
        createdAt: fe.createdAt ?? clock.now(),
        updatedAt: clock.now(),
        deleted: false,
      }
      if (!outByLocalId.has(localId)) addedEvents++
      outByLocalId.set(localId, next)
    }
  }

  return {
    categories: outCats,
    tags: outTags,
    events: [...outByLocalId.values()],
    summary: {
      addedEvents,
      overwrittenEvents,
      unchangedEvents,
      invalidEvents,
      addedCategories: catCounters.added,
      reusedCategories: catCounters.reused,
      addedTags: tagCounters.added,
      reusedTags: tagCounters.reused,
    },
  }
}
