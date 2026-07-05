import type { EventRecord, Category, Id } from '../domain/model'
import type { Scope } from './types'

export const EMPTY_SCOPE: Scope = { folderIds: [], includeEvents: [], excludeEvents: [] }

export function isScopeEmpty(s: Scope): boolean {
  return s.folderIds.length === 0 && s.includeEvents.length === 0
}

// 某分类及其所有活跃子孙分类的 id（迁自 selectors.ts，语义不变）。
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

// 所有已勾选文件夹的 id + 其全部子孙分类 id 的并集。
export function scopedCategoryIds(scope: Scope, categories: Category[]): Set<Id> {
  const out = new Set<Id>()
  for (const f of scope.folderIds) for (const id of descendantCategoryIds(categories, f)) out.add(id)
  return out
}

// 事件是否落在范围内。`scoped` 可预先算好以复用（热路径）。
export function isMember(scope: Scope, e: EventRecord, categories: Category[], scoped?: Set<Id>): boolean {
  if (e.deleted) return false
  if (scope.includeEvents.includes(e.id)) return true
  const set = scoped ?? scopedCategoryIds(scope, categories)
  return e.categoryId != null && set.has(e.categoryId) && !scope.excludeEvents.includes(e.id)
}

// 范围内事件 id 集（scoped 只算一次）。
export function memberEventIds(scope: Scope, categories: Category[], events: EventRecord[]): Set<Id> {
  const scoped = scopedCategoryIds(scope, categories)
  const out = new Set<Id>()
  for (const e of events) if (isMember(scope, e, categories, scoped)) out.add(e.id)
  return out
}

export type CheckState = 'checked' | 'indeterminate' | 'unchecked'

function ancestorChain(categories: Category[], id: Id): Id[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const chain: Id[] = []
  let cur: Id | null = id
  while (cur != null) {
    chain.push(cur)
    cur = byId.get(cur)?.parentId ?? null
  }
  return chain
}

// 文件夹三态：由其子孙事件的成员情况推导；空文件夹回退看它/祖先是否显式勾选。
export function folderCheckState(
  folderId: Id,
  categories: Category[],
  events: EventRecord[],
  members: Set<Id>,
  checkedFolders: Set<Id>,
): CheckState {
  const catIds = descendantCategoryIds(categories, folderId)
  const desc = events.filter((e) => !e.deleted && e.categoryId != null && catIds.has(e.categoryId))
  if (desc.length > 0) {
    let m = 0
    for (const e of desc) if (members.has(e.id)) m++
    if (m === 0) return 'unchecked'
    if (m === desc.length) return 'checked'
    return 'indeterminate'
  }
  return ancestorChain(categories, folderId).some((id) => checkedFolders.has(id)) ? 'checked' : 'unchecked'
}

// 勾选切换：已选 → 整体取消；未选/半选 → 整体勾选。
export function toggleFolder(scope: Scope, folderId: Id, categories: Category[], events: EventRecord[]): Scope {
  const members = memberEventIds(scope, categories, events)
  const state = folderCheckState(folderId, categories, events, members, new Set(scope.folderIds))
  const catIds = descendantCategoryIds(categories, folderId) // 文件夹 + 子孙
  const descEventIds = new Set(
    events.filter((e) => e.categoryId != null && catIds.has(e.categoryId)).map((e) => e.id),
  )
  const base: Scope = {
    folderIds: scope.folderIds.filter((id) => !catIds.has(id)), // 去掉自身与子孙文件夹
    includeEvents: scope.includeEvents.filter((id) => !descEventIds.has(id)),
    excludeEvents: scope.excludeEvents.filter((id) => !descEventIds.has(id)),
  }
  if (state === 'checked') return base // 取消
  return { ...base, folderIds: [...base.folderIds, folderId] } // 勾选整棵子树
}

export function toggleEvent(scope: Scope, e: EventRecord, categories: Category[]): Scope {
  const member = isMember(scope, e, categories)
  if (member) {
    if (scope.includeEvents.includes(e.id)) {
      return { ...scope, includeEvents: scope.includeEvents.filter((id) => id !== e.id) }
    }
    return { ...scope, excludeEvents: [...scope.excludeEvents, e.id] } // 经文件夹覆盖 → 排除
  }
  if (scope.excludeEvents.includes(e.id)) {
    return { ...scope, excludeEvents: scope.excludeEvents.filter((id) => id !== e.id) }
  }
  return { ...scope, includeEvents: [...scope.includeEvents, e.id] }
}

export function soloFolder(folderId: Id): Scope {
  return { folderIds: [folderId], includeEvents: [], excludeEvents: [] }
}

// 删除后清掉范围里已失效（tombstoned/不存在）的 id。
export function pruneScope(scope: Scope, categories: Category[], events: EventRecord[]): Scope {
  const liveCat = new Set(categories.filter((c) => !c.deleted).map((c) => c.id))
  const liveEv = new Set(events.filter((e) => !e.deleted).map((e) => e.id))
  return {
    folderIds: scope.folderIds.filter((id) => liveCat.has(id)),
    includeEvents: scope.includeEvents.filter((id) => liveEv.has(id)),
    excludeEvents: scope.excludeEvents.filter((id) => liveEv.has(id)),
  }
}
