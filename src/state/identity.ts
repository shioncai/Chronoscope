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
// the target folder. (Intra-batch same-title dups are handled at apply time.)
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
