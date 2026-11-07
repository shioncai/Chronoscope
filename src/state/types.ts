import type { EventRecord, Category, Tag, Id } from '../domain/model'
import type { AxisKind, LinearView } from '../domain/time'
import type { Locale } from '../domain/locale'

export type Theme = 'day' | 'night'
/** What the user picked; `system` follows the OS and resolves to a Theme. */
export type ThemeMode = 'system' | Theme
export type View = 'list' | 'timeline'
export type TagMode = 'and' | 'or'

// 勾选的文件夹/事件构成的筛选范围。空范围 = 所有事件。
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

/** The data mutations the history can undo — what a toast or tooltip names. */
export type HistoryAction =
  | 'event.create'
  | 'event.update'
  | 'event.duplicate'
  | 'event.delete'
  | 'event.restore'
  | 'event.purge'
  | 'event.move'
  | 'event.tag'
  | 'event.untag'
  | 'folder.create'
  | 'folder.update'
  | 'folder.delete'
  | 'folder.move'
  | 'tag.create'
  | 'tag.update'
  | 'tag.delete'
  | 'import'
  | 'sample'

export interface HistoryInfo {
  action: HistoryAction
  /** How many records the action was about (events, usually). */
  count: number
}

export interface AppState {
  events: EventRecord[]
  categories: Category[]
  tags: Tag[]
  filter: Filter
  selectedId: Id | null
  view: View
  sort: Sort
  themeMode: ThemeMode
  /** The resolved theme — themeMode with `system` already decided. */
  theme: Theme
  locale: Locale
  nowYear: number
  // Timeline zoom/pan, in the active axis's u coordinate, kept here (not in
  // TimelineView) so it survives the view switch that unmounts the timeline.
  // null = "not yet touched, fall back to the data bounds". Session state.
  timelineView: LinearView | null
  timelineOverview: LinearView | null
  /** Display magnification (1 = normal). */
  timelineScale: number
  timelineAxis: AxisKind
  /** Group the timeline into one lane per top-level folder. */
  timelineLanes: boolean
  /** A pending "show this event on the timeline" — consumed by the timeline. */
  reveal: Id | null
  // 列表视图中被勾选的事件（集合）。临时会话态，与 selectedId 完全独立。
  checkedIds: Id[]
  /** The top of each history stack, so the UI can label undo/redo. */
  history: { undo: HistoryInfo | null; redo: HistoryInfo | null }
  loaded: boolean
}

export const EMPTY_FILTER: Filter = {
  scope: { folderIds: [], includeEvents: [], excludeEvents: [] },
  uncategorized: false,
  untagged: false,
  trash: false,
  tagIds: [],
  tagMode: 'or',
  query: '',
}

export function initialAppState(nowYear: number, theme: Theme, locale: Locale = 'zh'): AppState {
  return {
    events: [],
    categories: [],
    tags: [],
    filter: EMPTY_FILTER,
    selectedId: null,
    view: 'list',
    sort: { key: 'start', dir: 'asc' },
    themeMode: theme,
    theme,
    locale,
    nowYear,
    timelineView: null,
    timelineOverview: null,
    timelineScale: 1,
    timelineAxis: 'linear',
    timelineLanes: false,
    reveal: null,
    checkedIds: [],
    history: { undo: null, redo: null },
    loaded: false,
  }
}
