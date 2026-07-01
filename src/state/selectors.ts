import type { EventRecord, Category, Id } from '../domain/model'
import { instantOf } from '../domain/time'
import type { AppState, Filter, Sort } from './types'

export function descendantCategoryIds(categories: Category[], rootId: Id): Set<Id> {
  const childrenOf = new Map<Id | null, Category[]>()
  for (const c of categories) {
    if (c.deleted) continue
    const arr = childrenOf.get(c.parentId) ?? []
    arr.push(c)
    childrenOf.set(c.parentId, arr)
  }
  const out = new Set<Id>()
  const walk = (id: Id) => {
    if (out.has(id)) return
    out.add(id)
    for (const child of childrenOf.get(id) ?? []) walk(child.id)
  }
  walk(rootId)
  return out
}

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
export function categoryEventCounts(state: AppState): Map<Id, number> {
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

function matchesQuery(e: EventRecord, query: string): boolean {
  const q = query.trim().toLowerCase()
  return !q || `${e.title} ${e.note}`.toLowerCase().includes(q)
}

function matchesFilter(e: EventRecord, filter: Filter, categories: Category[]): boolean {
  if (filter.uncategorized) {
    if (e.categoryId != null) return false
  } else if (filter.categoryId) {
    const ids = descendantCategoryIds(categories, filter.categoryId)
    if (!e.categoryId || !ids.has(e.categoryId)) return false
  }
  if (filter.untagged && e.tagIds.length > 0) return false
  if (filter.tagIds.length > 0) {
    const has = (t: Id) => e.tagIds.includes(t)
    if (filter.tagMode === 'and' ? !filter.tagIds.every(has) : !filter.tagIds.some(has)) return false
  }
  return matchesQuery(e, filter.query)
}

function sortValue(e: EventRecord, sort: Sort, catName: (id: Id | null) => string, tagName: (id: Id) => string): number | string {
  switch (sort.key) {
    case 'start':
      return e.start ? instantOf(e.start) : e.end ? instantOf(e.end) : Number.POSITIVE_INFINITY
    case 'title':
      return e.title
    case 'category':
      return e.categoryId != null ? catName(e.categoryId) : '￿'
    case 'tags':
      return e.tagIds.length
        ? e.tagIds.map((id) => tagName(id)).filter(Boolean).sort().join(' ')
        : '￿'
    case 'note':
      return e.note || '￿'
    case 'updated':
      return e.updatedAt
  }
}

export function visibleEvents(state: AppState): EventRecord[] {
  const cats = state.categories
  const catName = (id: Id | null) => cats.find((c) => c.id === id)?.name ?? ''
  const tagName = (id: Id) => state.tags.find((t) => t.id === id)?.name ?? ''
  const base = state.filter.trash
    ? state.events.filter((e) => e.deleted && matchesQuery(e, state.filter.query))
    : state.events.filter((e) => !e.deleted && matchesFilter(e, state.filter, cats))
  const dir = state.sort.dir === 'asc' ? 1 : -1
  return [...base].sort((a, b) => {
    const va = sortValue(a, state.sort, catName, tagName)
    const vb = sortValue(b, state.sort, catName, tagName)
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb)) * dir
  })
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

// Valid new parents for `id`: every live category except `id` itself and its
// descendants (moving into one of those would create a cycle).
export function assignableParents(categories: Category[], id: Id): { category: Category; depth: number }[] {
  const excluded = descendantCategoryIds(categories, id)
  return flattenCategoryTree(categories).filter((e) => !excluded.has(e.category.id))
}

export function untaggedCount(state: AppState): number {
  return state.events.filter((e) => !e.deleted && e.tagIds.length === 0).length
}
export function deletedCount(state: AppState): number {
  return state.events.filter((e) => e.deleted).length
}
