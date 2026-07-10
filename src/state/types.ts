import type { EventRecord, Category, Tag, Id } from '../domain/model'
import type { LinearView } from '../domain/time'
import type { Locale } from '../domain/locale'

export type Theme = 'day' | 'night'
export type View = 'list' | 'timeline'
export type TagMode = 'and' | 'or'

// 勾选的文件夹/事件构成的筛选范围。空范围 = 所有事件。取代旧的单选 categoryId。
export interface Scope {
  folderIds: Id[] // 显式勾选的文件夹（级联其所有子孙文件夹与事件）
  includeEvents: Id[] // 在“未被文件夹覆盖”的位置单独勾选的事件
  excludeEvents: Id[] // 在“已被文件夹覆盖”的范围里单独排除的事件
}

export interface Filter {
  scope: Scope
  uncategorized?: boolean // true → 仅显示未分类事件（与 scope 互斥）
  untagged?: boolean // true → 仅显示无标签事件
  trash?: boolean // true → 回收站：仅显示已删除事件
  tagIds: Id[]
  tagMode: TagMode
  query: string
}

export interface Sort {
  key: 'start' | 'title' | 'category' | 'tags' | 'note' | 'updated'
  dir: 'asc' | 'desc'
}

export interface AppState {
  events: EventRecord[]
  categories: Category[]
  tags: Tag[]
  filter: Filter
  selectedId: Id | null
  view: View
  sort: Sort
  theme: Theme
  locale: Locale
  nowYear: number
  // Timeline zoom/pan, kept here (not in TimelineView) so it survives the view
  // switch that unmounts the timeline. null = "not yet touched, fall back to the
  // data bounds". Ephemeral session state: not persisted, not exported.
  timelineView: LinearView | null
  timelineOverview: LinearView | null
  // Timeline display magnification (1 = normal). Session state like the view/
  // overview above: not persisted, not exported; resets on reload.
  timelineScale: number
  // 列表视图中被勾选的事件(当作集合用,去重)。临时会话态:不持久化、
  // 不导出;与 selectedId(打开编辑器的单选)完全独立。
  checkedIds: Id[]
  loaded: boolean
}

export function initialAppState(nowYear: number, theme: Theme, locale: Locale = 'zh'): AppState {
  return {
    events: [],
    categories: [],
    tags: [],
    filter: { scope: { folderIds: [], includeEvents: [], excludeEvents: [] }, uncategorized: false, untagged: false, trash: false, tagIds: [], tagMode: 'or', query: '' },
    selectedId: null,
    view: 'list',
    sort: { key: 'start', dir: 'asc' },
    theme,
    locale,
    nowYear,
    timelineView: null,
    timelineOverview: null,
    timelineScale: 1,
    checkedIds: [],
    loaded: false,
  }
}
