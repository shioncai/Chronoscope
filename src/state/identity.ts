import type { EventRecord, Category, Id } from '../domain/model'

export function eventKey(title: string): string {
  return title.trim()
}

// The live event occupying (title, categoryId) — the "file" at that path/name.
export function liveEventAt(
  events: EventRecord[],
  title: string,
  categoryId: Id | null,
  exceptId?: Id,
): EventRecord | undefined {
  const key = eventKey(title)
  return events.find(
    (e) => !e.deleted && e.id !== exceptId && e.categoryId === categoryId && eventKey(e.title) === key,
  )
}

// The live folder occupying (name, parentId) — the "directory" at that path.
export function liveFolderAt(
  categories: Category[],
  name: string,
  parentId: Id | null,
  exceptId?: Id,
): Category | undefined {
  const key = eventKey(name)
  return categories.find(
    (c) => !c.deleted && c.id !== exceptId && c.parentId === parentId && eventKey(c.name) === key,
  )
}

export type EventDiffField = 'time' | 'note' | 'tags' | 'links'

function sameTime(a: EventRecord, b: EventRecord): boolean {
  return (
    JSON.stringify(a.start ?? null) === JSON.stringify(b.start ?? null) &&
    JSON.stringify(a.end ?? null) === JSON.stringify(b.end ?? null)
  )
}
function sameSet(a: Id[], b: Id[]): boolean {
  const sa = new Set(a)
  const sb = new Set(b)
  if (sa.size !== sb.size) return false
  for (const x of sa) if (!sb.has(x)) return false
  return true
}

// Which display fields differ (title + folder are equal for a real conflict).
export function eventDiffFields(a: EventRecord, b: EventRecord): EventDiffField[] {
  const out: EventDiffField[] = []
  if (!sameTime(a, b)) out.push('time')
  if ((a.note ?? '') !== (b.note ?? '')) out.push('note')
  if (!sameSet(a.tagIds, b.tagIds)) out.push('tags')
  if (!sameSet(a.links, b.links)) out.push('links')
  return out
}

export interface MoveConflict {
  movingId: Id
  existingId: Id
}

// Selected events that would collide with a live same-title event already in
// the target folder. (Intra-batch same-title dups are handled at apply time
// by dedupeTargetMovers.)
export function moveConflicts(events: EventRecord[], ids: Id[], targetId: Id | null): MoveConflict[] {
  const idSet = new Set(ids)
  const out: MoveConflict[] = []
  for (const id of ids) {
    const e = events.find((x) => x.id === id)
    if (!e || e.deleted || e.categoryId === targetId) continue // missing / already there
    const existing = liveEventAt(events, e.title, targetId)
    if (existing && !idSet.has(existing.id)) out.push({ movingId: id, existingId: existing.id })
  }
  return out
}

// The subset of moveIds that can move into targetId without duplicating a
// title already living there (or another accepted mover). Keep the first for
// each title, skip the rest. `supersededIds` = occupants being sent to trash
// (an overwrite), which free up their title. This is the last line of defense
// for the (title, folder) uniqueness invariant: moveConflicts only flags a
// mover against an occupant NOT in the selection, so two same-title movers into
// an empty folder — or a mover colliding with a same-title occupant that is
// itself selected — slip past it and must be auto-skipped here.
export function dedupeTargetMovers(
  events: EventRecord[],
  moveIds: Id[],
  targetId: Id | null,
  supersededIds: Set<Id> = new Set(),
): Id[] {
  const claimed = new Set<string>()
  for (const e of events) {
    if (!e.deleted && e.categoryId === targetId && !supersededIds.has(e.id)) claimed.add(eventKey(e.title))
  }
  const result: Id[] = []
  for (const id of moveIds) {
    const e = events.find((x) => x.id === id)
    if (!e || e.deleted || e.categoryId === targetId) continue // missing / already there
    const key = eventKey(e.title)
    if (claimed.has(key)) continue // would duplicate a claimed title → auto-skip
    claimed.add(key)
    result.push(id)
  }
  return result
}
