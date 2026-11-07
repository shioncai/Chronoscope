import type { EventRecord, Category, Tag, Id } from '../domain/model'
import { instantOf } from '../domain/time'
import type { AppState, Filter, Sort } from './types'
import { isMember, isScopeEmpty, scopedCategoryIds } from './scope'

export interface CategoryNode {
  category: Category
  children: CategoryNode[]
}

export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const live = categories.filter((c) => !c.deleted).sort((a, b) => a.order - b.order)
  const byParent = new Map<Id | null, Category[]>()
  for (const c of live) {
    const arr = byParent.get(c.parentId) ?? []
    arr.push(c)
    byParent.set(c.parentId, arr)
  }
  const build = (parentId: Id | null): CategoryNode[] =>
    (byParent.get(parentId) ?? []).map((c) => ({ category: c, children: build(c.id) }))
  return build(null)
}

// Descendant-inclusive count of live events per category: each category's tally
// includes events filed directly under it and under any of its subcategories.
export function categoryEventCounts(state: Pick<AppState, 'events' | 'categories'>): Map<Id, number> {
  const direct = new Map<Id, number>()
  for (const e of state.events) {
    if (e.deleted || e.categoryId == null) continue
    direct.set(e.categoryId, (direct.get(e.categoryId) ?? 0) + 1)
  }
  const live = state.categories.filter((c) => !c.deleted)
  const childrenOf = new Map<Id | null, Id[]>()
  for (const c of live) {
    const arr = childrenOf.get(c.parentId) ?? []
    arr.push(c.id)
    childrenOf.set(c.parentId, arr)
  }
  const totals = new Map<Id, number>()
  const total = (id: Id): number => {
    const cached = totals.get(id)
    if (cached !== undefined) return cached
    let sum = direct.get(id) ?? 0
    for (const child of childrenOf.get(id) ?? []) sum += total(child)
    totals.set(id, sum)
    return sum
  }
  for (const c of live) total(c.id)
  return totals
}

// `q` is pre-trimmed and pre-lowercased once per query, not once per event.
// A query matches the title, the note, the folder's name or any tag's name —
// so typing a tag finds what carries it, in both views.
function matchesQuery(e: EventRecord, q: string, names: QueryNames): boolean {
  if (!q) return true
  if (e.title.toLowerCase().includes(q) || e.note.toLowerCase().includes(q)) return true
  if (e.categoryId != null && names.folders.get(e.categoryId)?.includes(q)) return true
  return e.tagIds.some((id) => names.tags.get(id)?.includes(q))
}

interface QueryNames {
  folders: Map<Id, string>
  tags: Map<Id, string>
}

function matchesFilter(e: EventRecord, filter: Filter, categories: Category[], scoped: Set<Id>, q: string, names: QueryNames): boolean {
  if (filter.uncategorized) {
    if (e.categoryId != null) return false
  } else if (!isScopeEmpty(filter.scope)) {
    if (!isMember(filter.scope, e, categories, scoped)) return false
  }
  if (filter.untagged && e.tagIds.length > 0) return false
  if (filter.tagIds.length > 0) {
    const has = (t: Id) => e.tagIds.includes(t)
    if (filter.tagMode === 'and' ? !filter.tagIds.every(has) : !filter.tagIds.some(has)) return false
  }
  return matchesQuery(e, q, names)
}

function sortValue(e: EventRecord, sort: Sort, catName: Map<Id, string>, tagName: Map<Id, string>): number | string {
  switch (sort.key) {
    case 'start':
      return e.start ? instantOf(e.start) : e.end ? instantOf(e.end) : Number.POSITIVE_INFINITY
    case 'title':
      return e.title
    case 'category':
      return e.categoryId != null ? catName.get(e.categoryId) ?? '' : '￿'
    case 'tags':
      return e.tagIds.length
        ? e.tagIds.map((id) => tagName.get(id) ?? '').filter(Boolean).sort().join(' ')
        : '￿'
    case 'note':
      return e.note || '￿'
    case 'updated':
      return e.updatedAt
  }
}

// One collator for the whole app. `String.localeCompare` builds (or looks up) a
// collator on every call, and the comparator runs O(n log n) times — reusing one
// is the difference between a sort that stays instant on a long list and one
// that does not.
const COLLATOR = new Intl.Collator()

/** Exactly the slices `visibleEvents` reads — so a caller can memoize on them
 *  instead of on the whole AppState (`AppState` satisfies this structurally). */
export interface VisibleEventsInput {
  events: EventRecord[]
  categories: Category[]
  tags: Tag[]
  filter: Filter
  sort: Sort
}

export function visibleEvents(state: VisibleEventsInput): EventRecord[] {
  const { filter, sort } = state
  const q = filter.query.trim().toLowerCase()
  const scoped = scopedCategoryIds(filter.scope, state.categories)
  const lower = (xs: { id: Id; name: string; deleted: boolean }[]) =>
    new Map(q ? xs.filter((x) => !x.deleted).map((x) => [x.id, x.name.toLowerCase()]) : [])
  const names: QueryNames = { folders: lower(state.categories), tags: lower(state.tags) }
  const base = filter.trash
    ? state.events.filter((e) => e.deleted && matchesQuery(e, q, names))
    : state.events.filter((e) => !e.deleted && matchesFilter(e, filter, state.categories, scoped, q, names))

  // Decorate–sort–undecorate: each row's sort key is derived ONCE rather than
  // on every comparison, and the names behind it come from maps instead of a
  // linear scan of categories/tags per lookup. `sort` is stable, so equal keys
  // keep their filtered order exactly as before.
  const catName = new Map<Id, string>(state.categories.map((c) => [c.id, c.name]))
  const tagName = new Map<Id, string>(
    state.tags.filter((t) => !t.deleted).map((t) => [t.id, t.name]),
  )
  const dir = sort.dir === 'asc' ? 1 : -1
  const keyed = base.map((e) => ({ e, key: sortValue(e, sort, catName, tagName) }))
  keyed.sort((a, b) =>
    typeof a.key === 'number' && typeof b.key === 'number'
      ? (a.key - b.key) * dir
      : COLLATOR.compare(String(a.key), String(b.key)) * dir,
  )
  return keyed.map((x) => x.e)
}

export function flattenCategoryTree(categories: Category[]): { category: Category; depth: number }[] {
  const out: { category: Category; depth: number }[] = []
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const n of nodes) {
      out.push({ category: n.category, depth })
      walk(n.children, depth + 1)
    }
  }
  walk(buildCategoryTree(categories), 0)
  return out
}

export interface OverviewCounts {
  total: number // live events
  uncategorized: number
  untagged: number
  deleted: number
}

// The sidebar's four tallies in a single pass over the events, instead of four
// separate full scans.
export function overviewCounts(events: EventRecord[]): OverviewCounts {
  let total = 0
  let uncategorized = 0
  let untagged = 0
  let deleted = 0
  for (const e of events) {
    if (e.deleted) {
      deleted++
      continue
    }
    total++
    if (e.categoryId == null) uncategorized++
    if (e.tagIds.length === 0) untagged++
  }
  return { total, uncategorized, untagged, deleted }
}
