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

/**
 * 每个活跃文件夹的三态：由其子孙事件的成员情况推导；空文件夹（子树内无事件）
 * 回退看它自身或某个祖先是否被显式勾选。
 *
 * 一次算出全部文件夹，而不是每行算一次：侧边栏要为每一行取这个状态，而单行版本
 * 需重建整棵子孙表并全表扫描事件，行数一多就是 O(行 × (分类 + 事件))。这里自上
 * 而下走一遍森林即可，总代价 O(分类 + 事件)。
 */
export function folderCheckStates(
  categories: Category[],
  events: EventRecord[],
  members: Set<Id>,
  checkedFolders: Set<Id>,
): Map<Id, CheckState> {
  const live = categories.filter((c) => !c.deleted)
  const liveIds = new Set(live.map((c) => c.id))
  const childrenOf = new Map<Id, Id[]>()
  for (const c of live) {
    if (c.parentId == null || !liveIds.has(c.parentId)) continue
    const arr = childrenOf.get(c.parentId) ?? []
    arr.push(c.id)
    childrenOf.set(c.parentId, arr)
  }

  // 每个分类直属的事件数 / 其中在范围内的数量（只扫一遍事件表）
  const directTotal = new Map<Id, number>()
  const directMembers = new Map<Id, number>()
  for (const e of events) {
    if (e.deleted || e.categoryId == null) continue
    directTotal.set(e.categoryId, (directTotal.get(e.categoryId) ?? 0) + 1)
    if (members.has(e.id)) directMembers.set(e.categoryId, (directMembers.get(e.categoryId) ?? 0) + 1)
  }

  const out = new Map<Id, CheckState>()
  const seen = new Set<Id>() // 防御坏数据里的父子环
  // 向下传 `ancestorChecked`，等价于旧版逐行回溯祖先链。
  const walk = (id: Id, ancestorChecked: boolean): { total: number; member: number } => {
    if (seen.has(id)) return { total: 0, member: 0 }
    seen.add(id)
    const checked = ancestorChecked || checkedFolders.has(id)
    let total = directTotal.get(id) ?? 0
    let member = directMembers.get(id) ?? 0
    for (const child of childrenOf.get(id) ?? []) {
      const sub = walk(child, checked)
      total += sub.total
      member += sub.member
    }
    let state: CheckState
    if (total === 0) state = checked ? 'checked' : 'unchecked'
    else if (member === 0) state = 'unchecked'
    else if (member === total) state = 'checked'
    else state = 'indeterminate'
    out.set(id, state)
    return { total, member }
  }
  for (const c of live) {
    if (c.parentId == null || !liveIds.has(c.parentId)) walk(c.id, false)
  }
  return out
}

// 勾选切换：已选 → 整体取消；未选/半选 → 整体勾选。
export function toggleFolder(scope: Scope, folderId: Id, categories: Category[], events: EventRecord[]): Scope {
  const members = memberEventIds(scope, categories, events)
  const state = folderCheckStates(categories, events, members, new Set(scope.folderIds)).get(folderId) ?? 'unchecked'
  const catIds = descendantCategoryIds(categories, folderId) // 文件夹 + 子孙
  const descEventIds = new Set(
    events.filter((e) => e.categoryId != null && catIds.has(e.categoryId)).map((e) => e.id),
  )
  const base: Scope = {
    folderIds: scope.folderIds.filter((id) => !catIds.has(id)), // 去掉自身与子孙文件夹
    includeEvents: scope.includeEvents.filter((id) => !descEventIds.has(id)),
    excludeEvents: scope.excludeEvents.filter((id) => !descEventIds.has(id)),
  }
  if (state === 'checked') {
    // 取消整棵子树。若某祖先文件夹仍被勾选，其子孙事件会继续经祖先覆盖而留在
    // 范围内——必须显式排除这些仍被覆盖的事件，否则子文件夹“取消不掉”。
    const scopedAfter = scopedCategoryIds(base, categories)
    const stillCovered = events
      .filter((e) => !e.deleted && descEventIds.has(e.id) && e.categoryId != null && scopedAfter.has(e.categoryId))
      .map((e) => e.id)
    return stillCovered.length ? { ...base, excludeEvents: [...base.excludeEvents, ...stillCovered] } : base
  }
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
