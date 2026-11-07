import { newEvent, touch, softDelete, type Database, type Clock, type NewEventFields } from '../data'
import type { EventRecord, Category, Tag, Id } from '../domain/model'
import { migrateEventTimes, type AxisKind, type LinearView } from '../domain/time'
import type { Locale } from '../domain/locale'
import { createStore, type Store } from './store'
import { descendantCategoryIds } from './scope'
import { reorderedCategories } from './categoryOrder'
import { planRestore, planImport, type ImportSummary, type RestoreConflict } from './importPlan'
import { buildTransferFile, parseTransferFile, type TransferFile, type TransferError } from './transfer'
import { buildCsv, parseCsv } from './csv'
import type { Prefs } from './prefs'
import {
  initialAppState,
  EMPTY_FILTER,
  type AppState,
  type Filter,
  type HistoryAction,
  type HistoryInfo,
  type Sort,
  type Theme,
  type ThemeMode,
  type View,
} from './types'

export interface AppStoreDeps {
  db: Database
  clock: Clock
  nowYear: number
  theme: Theme
  themeMode?: ThemeMode
  locale?: Locale
  prefs?: Partial<Prefs>
  genId?: () => string
}

export type ImportFormat = 'json' | 'csv'

export type ImportOutcome =
  | { ok: true; summary: ImportSummary }
  | { ok: false; error: TransferError | 'csv-header'; version?: string }

export interface AppStore {
  store: Store<AppState>
  load(): Promise<void>
  exportData(): TransferFile
  exportCsv(): string
  importData(text: string, format?: ImportFormat): Promise<ImportOutcome>
  /** Merge an already-parsed file (an import, or the sample timeline). */
  importFile(file: TransferFile, action?: 'import' | 'sample', invalid?: number): Promise<ImportSummary>
  createEvent(fields: NewEventFields): Promise<Id>
  updateEvent(id: Id, changes: Partial<EventRecord>): Promise<void>
  /** A copy of the event under a new title, in the same folder. */
  duplicateEvent(id: Id, title: string): Promise<Id>
  deleteEvent(id: Id): Promise<void>
  deleteEvents(ids: Id[]): Promise<void>
  // Recycle bin: restore un-tombstones (soft), purge hard-deletes.
  restoreEvents(ids: Id[], resolutions?: Record<Id, 'overwrite' | 'skip'>): Promise<{ conflicts: RestoreConflict[] }>
  purgeEvents(ids: Id[]): Promise<void>
  emptyTrash(): Promise<void>
  setEventsCategory(ids: Id[], categoryId: Id | null): Promise<void>
  addTagToEvents(ids: Id[], tagId: Id): Promise<void>
  removeTagFromEvents(ids: Id[], tagId: Id): Promise<void>
  createCategory(fields: { name: string; parentId?: Id | null; color?: string; order?: number }): Promise<Id>
  updateCategory(id: Id, changes: Partial<Category>): Promise<void>
  deleteCategory(id: Id): Promise<void>
  moveCategory(id: Id, parentId: Id | null, beforeId?: Id | null): Promise<void>
  /** Returns the existing tag's id when a live tag already has the name. */
  createTag(fields: { name: string; color?: string }): Promise<Id>
  updateTag(id: Id, changes: Partial<Tag>): Promise<void>
  deleteTag(id: Id): Promise<void>
  undo(): Promise<HistoryInfo | null>
  redo(): Promise<HistoryInfo | null>
  setFilter(patch: Partial<Filter>): void
  resetFilter(): void
  select(id: Id | null): void
  toggleChecked(id: Id): void
  setChecked(ids: Id[]): void
  setView(view: View): void
  /** Switch to the timeline, select the event and bring it into view. */
  revealEvent(id: Id): void
  clearReveal(): void
  setSort(sort: Sort): void
  setThemeMode(mode: ThemeMode, systemPrefersDark?: boolean): void
  setTheme(theme: Theme): void
  setLocale(locale: Locale): void
  setNowYear(nowYear: number): void
  setTimelineView(updater: LinearView | ((prev: LinearView | null) => LinearView)): void
  setTimelineOverview(updater: LinearView | ((prev: LinearView | null) => LinearView)): void
  setTimelineScale(updater: number | ((prev: number) => number)): void
  setTimelineAxis(axis: AxisKind): void
  setTimelineLanes(on: boolean): void
}

// ── changes ─────────────────────────────────────────────────────────────────
// Every data mutation is a Change: records to write and ids to hard-delete, per
// table. Applying one returns its inverse, which is all an undo needs.

interface TableChange<T> {
  put?: T[]
  remove?: Id[]
}
interface Change {
  events?: TableChange<EventRecord>
  categories?: TableChange<Category>
  tags?: TableChange<Tag>
}
const TABLES = ['events', 'categories', 'tags'] as const

interface HistoryEntry extends HistoryInfo {
  change: Change
}
const HISTORY_LIMIT = 100

function isEmpty(c: Change): boolean {
  return TABLES.every((t) => !c[t] || ((c[t]!.put?.length ?? 0) === 0 && (c[t]!.remove?.length ?? 0) === 0))
}

// The same as folding an upsert over a batch, in ONE pass: existing records
// keep their position, genuinely new ones are appended in batch order.
function upsertMany<T extends { id: Id }>(list: T[], recs: T[]): T[] {
  if (recs.length === 0) return list
  const pending = new Map(recs.map((r) => [r.id, r]))
  const out: T[] = []
  for (const x of list) {
    const rec = pending.get(x.id)
    if (rec === undefined) out.push(x)
    else {
      out.push(rec)
      pending.delete(x.id)
    }
  }
  for (const rec of pending.values()) out.push(rec)
  return out
}

function patch<T extends { id: Id }>(list: T[], c: TableChange<T> | undefined): T[] {
  if (!c) return list
  const removed = new Set(c.remove ?? [])
  const kept = removed.size > 0 ? list.filter((x) => !removed.has(x.id)) : list
  return upsertMany(kept, c.put ?? [])
}

function inverseOf<T extends { id: Id }>(list: T[], c: TableChange<T> | undefined): TableChange<T> | undefined {
  if (!c) return undefined
  const byId = new Map(list.map((r) => [r.id, r]))
  const put: T[] = []
  const remove: Id[] = []
  const seen = new Set<Id>()
  for (const r of c.put ?? []) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    const prev = byId.get(r.id)
    if (prev) put.push(prev)
    else remove.push(r.id)
  }
  for (const id of c.remove ?? []) {
    if (seen.has(id)) continue
    seen.add(id)
    const prev = byId.get(id)
    if (prev) put.push(prev)
  }
  return { put, remove }
}

/**
 * Keep the session state coherent with the data after any change: a selection
 * or a checked row that no longer exists in the current mode (live vs recycle
 * bin) is dropped, and the filter forgets folders and tags that are gone.
 * Returns the same objects when nothing changed, so nothing re-renders.
 */
function sanitize(s: AppState): AppState {
  const byId = new Map(s.events.map((e) => [e.id, e]))
  const fits = (id: Id) => {
    const e = byId.get(id)
    return e !== undefined && e.deleted === !!s.filter.trash
  }
  const selectedId = s.selectedId != null && !fits(s.selectedId) ? null : s.selectedId
  const checkedIds = s.checkedIds.every(fits) ? s.checkedIds : s.checkedIds.filter(fits)

  const liveCats = new Set(s.categories.filter((c) => !c.deleted).map((c) => c.id))
  const liveTags = new Set(s.tags.filter((t) => !t.deleted).map((t) => t.id))
  const liveEvent = (id: Id) => byId.get(id)?.deleted === false
  const sc = s.filter.scope
  const scopeOk =
    sc.folderIds.every((id) => liveCats.has(id)) &&
    sc.includeEvents.every(liveEvent) &&
    sc.excludeEvents.every(liveEvent)
  const tagsOk = s.filter.tagIds.every((id) => liveTags.has(id))
  const filter =
    scopeOk && tagsOk
      ? s.filter
      : {
          ...s.filter,
          scope: scopeOk
            ? sc
            : {
                folderIds: sc.folderIds.filter((id) => liveCats.has(id)),
                includeEvents: sc.includeEvents.filter(liveEvent),
                excludeEvents: sc.excludeEvents.filter(liveEvent),
              },
          tagIds: tagsOk ? s.filter.tagIds : s.filter.tagIds.filter((id) => liveTags.has(id)),
        }
  if (selectedId === s.selectedId && checkedIds === s.checkedIds && filter === s.filter) return s
  return { ...s, selectedId, checkedIds, filter }
}

export function createAppStore(deps: AppStoreDeps): AppStore {
  const { db, clock, theme, locale = 'zh' } = deps
  let nowYear = deps.nowYear
  const genId = deps.genId ?? (() => crypto.randomUUID())
  const base = initialAppState(nowYear, theme, locale)
  const store = createStore<AppState>({
    ...base,
    ...deps.prefs,
    themeMode: deps.themeMode ?? theme,
  })

  const undoStack: HistoryEntry[] = []
  const redoStack: HistoryEntry[] = []
  const top = (stack: HistoryEntry[]): HistoryInfo | null => {
    const e = stack[stack.length - 1]
    return e ? { action: e.action, count: e.count } : null
  }
  const publishHistory = () =>
    store.setState((s) => ({ ...s, history: { undo: top(undoStack), redo: top(redoStack) } }))

  /** Write a change to memory and disk; return what undoes it. */
  async function apply(change: Change): Promise<Change> {
    const s = store.getState()
    const inverse: Change = {
      events: inverseOf(s.events, change.events),
      categories: inverseOf(s.categories, change.categories),
      tags: inverseOf(s.tags, change.tags),
    }
    // Memory first, synchronously, so a second mutation issued before this one
    // reaches the disk still computes its inverse against the right state.
    store.setState((st) =>
      sanitize({
        ...st,
        events: patch(st.events, change.events),
        categories: patch(st.categories, change.categories),
        tags: patch(st.tags, change.tags),
      }),
    )
    for (const t of TABLES) {
      const c = change[t]
      if (!c) continue
      // the tables are typed per name; the loop is just the same two calls three times
      const repo = db[t] as unknown as { bulkPut(r: unknown[]): Promise<void>; bulkDelete(ids: Id[]): Promise<void> }
      if (c.put?.length) await repo.bulkPut(c.put)
      if (c.remove?.length) await repo.bulkDelete(c.remove)
    }
    return inverse
  }

  async function commit(change: Change, action: HistoryAction, count: number): Promise<void> {
    if (isEmpty(change)) return
    const inverse = await apply(change)
    undoStack.push({ action, count, change: inverse })
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift()
    redoStack.length = 0
    publishHistory()
  }

  // Undo and redo write records back with a FRESH timestamp: they are new
  // edits as far as the HLC is concerned, so a newer write always wins.
  const restamp = (c: Change): Change => {
    const stamp = <T extends { updatedAt: string }>(t?: TableChange<T>) =>
      t && { remove: t.remove, put: t.put?.map((r) => ({ ...r, updatedAt: clock.now() })) }
    return { events: stamp(c.events), categories: stamp(c.categories), tags: stamp(c.tags) }
  }

  async function travel(from: HistoryEntry[], to: HistoryEntry[]): Promise<HistoryInfo | null> {
    const entry = from.pop()
    if (!entry) return null
    const inverse = await apply(restamp(entry.change))
    to.push({ ...entry, change: inverse })
    publishHistory()
    return { action: entry.action, count: entry.count }
  }

  const find = (id: Id) => store.getState().events.find((e) => e.id === id)

  async function load(): Promise<void> {
    const [rawEvents, categories, tags] = await Promise.all([
      db.events.getAll(),
      db.categories.getAll(),
      db.tags.getAll(),
    ])
    // one-time, idempotent: convert legacy absolute-stored deep-time points to
    // ago offsets and persist the change, so exports stay clean and it happens once
    const events = rawEvents.map((e) => migrateEventTimes(e, nowYear) ?? e)
    const migrated = events.filter((e, i) => e !== rawEvents[i])
    if (migrated.length > 0) await db.events.bulkPut(migrated)
    store.setState((s) => sanitize({ ...s, events, categories, tags, loaded: true }))
  }

  async function importFile(file: TransferFile, action: 'import' | 'sample' = 'import', invalid = 0): Promise<ImportSummary> {
    const s = store.getState()
    // migrate incoming deep-time points (v1 files store absolute years);
    // idempotent, so v2 files pass through unchanged
    const migratedEvents = file.data.events.map((e) => migrateEventTimes(e, nowYear) ?? e)
    const plan = planImport(
      { events: s.events, categories: s.categories, tags: s.tags },
      { ...file.data, events: migratedEvents },
      clock,
      genId,
    )
    const touched = plan.summary.addedEvents + plan.summary.overwrittenEvents
    await commit(
      { categories: { put: plan.categories }, tags: { put: plan.tags }, events: { put: plan.events } },
      action,
      touched,
    )
    return { ...plan.summary, invalidEvents: plan.summary.invalidEvents + invalid }
  }

  async function purge(ids: Id[]): Promise<void> {
    const idSet = new Set(ids)
    const present = store.getState().events.filter((e) => idSet.has(e.id)).map((e) => e.id)
    await commit({ events: { remove: present } }, 'event.purge', present.length)
  }

  return {
    store,
    load,

    exportData() {
      const s = store.getState()
      return buildTransferFile({ events: s.events, categories: s.categories, tags: s.tags }, new Date().toISOString())
    },

    exportCsv() {
      const s = store.getState()
      return buildCsv({ events: s.events, categories: s.categories, tags: s.tags })
    },

    async importData(text, format = 'json') {
      if (format === 'csv') {
        const parsed = parseCsv(text, clock.now())
        if (!parsed.ok) return { ok: false, error: parsed.error }
        const file: TransferFile = { app: 'chronoscope', version: 2, exportedAt: '', data: parsed.data }
        return { ok: true, summary: await importFile(file, 'import', parsed.invalid) }
      }
      const parsed = parseTransferFile(text)
      if (!parsed.ok) return { ok: false, error: parsed.error, version: parsed.version }
      return { ok: true, summary: await importFile(parsed.file) }
    },

    importFile,

    async createEvent(fields) {
      const record = newEvent(fields, clock, genId)
      await commit({ events: { put: [record] } }, 'event.create', 1)
      return record.id
    },

    async updateEvent(id, changes) {
      const current = find(id)
      if (!current) throw new Error(`updateEvent: no event ${id}`)
      await commit({ events: { put: [touch(current, changes, clock)] } }, 'event.update', 1)
    },

    async duplicateEvent(id, title) {
      const src = find(id)
      if (!src) throw new Error(`duplicateEvent: no event ${id}`)
      const copy = newEvent(
        {
          title,
          start: src.start,
          end: src.end,
          note: src.note,
          categoryId: src.categoryId,
          tagIds: src.tagIds,
          links: src.links,
        },
        clock,
        genId,
      )
      await commit({ events: { put: [copy] } }, 'event.duplicate', 1)
      return copy.id
    },

    async deleteEvent(id) {
      const current = find(id)
      if (!current) throw new Error(`deleteEvent: no event ${id}`)
      if (current.deleted) return
      await commit({ events: { put: [softDelete(current, clock)] } }, 'event.delete', 1)
    },

    async deleteEvents(ids) {
      const idSet = new Set(ids)
      const changed = store
        .getState()
        .events.filter((e) => !e.deleted && idSet.has(e.id))
        .map((e) => softDelete(e, clock))
      store.setState((st) => ({ ...st, checkedIds: [] })) // the selection was just consumed
      await commit({ events: { put: changed } }, 'event.delete', changed.length)
    },

    async restoreEvents(ids, resolutions = {}) {
      const idSet = new Set(ids)
      const s0 = store.getState()
      // Restore un-tombstones each event and revives its full context (folder
      // ancestor chain + referenced tags). The planner merges by name/path
      // against live records, so if a same-name folder/tag already exists the
      // event re-homes into it instead of resurrecting a duplicate. If the
      // target folder already holds a live same-title event, the event is held
      // back as a conflict unless resolved via `resolutions` ('overwrite'
      // permanently removes the existing one; 'skip' leaves it deleted).
      const plan = planRestore({ events: s0.events, categories: s0.categories, tags: s0.tags }, ids, clock, resolutions)
      store.setState((st) => ({ ...st, checkedIds: st.checkedIds.filter((x) => !idSet.has(x)) }))
      await commit(
        {
          categories: { put: plan.categories },
          tags: { put: plan.tags },
          events: { put: plan.events, remove: plan.purge },
        },
        'event.restore',
        plan.events.length,
      )
      return { conflicts: plan.conflicts }
    },

    purgeEvents: purge,

    async emptyTrash() {
      await purge(store.getState().events.filter((e) => e.deleted).map((e) => e.id))
    },

    async setEventsCategory(ids, categoryId) {
      const idSet = new Set(ids)
      const changed = store
        .getState()
        .events.filter((e) => !e.deleted && idSet.has(e.id) && e.categoryId !== categoryId)
        .map((e) => touch(e, { categoryId }, clock))
      await commit({ events: { put: changed } }, 'event.move', changed.length)
    },

    async addTagToEvents(ids, tagId) {
      const idSet = new Set(ids)
      const changed = store
        .getState()
        .events.filter((e) => !e.deleted && idSet.has(e.id) && !e.tagIds.includes(tagId))
        .map((e) => touch(e, { tagIds: [...e.tagIds, tagId] }, clock))
      await commit({ events: { put: changed } }, 'event.tag', changed.length)
    },

    async removeTagFromEvents(ids, tagId) {
      const idSet = new Set(ids)
      const changed = store
        .getState()
        .events.filter((e) => !e.deleted && idSet.has(e.id) && e.tagIds.includes(tagId))
        .map((e) => touch(e, { tagIds: e.tagIds.filter((t) => t !== tagId) }, clock))
      await commit({ events: { put: changed } }, 'event.untag', changed.length)
    },

    async createCategory(fields) {
      const cat: Category = {
        id: genId(),
        name: fields.name,
        parentId: fields.parentId ?? null,
        color: fields.color ?? '#888888',
        order: fields.order ?? 0,
        updatedAt: clock.now(),
        deleted: false,
      }
      await commit({ categories: { put: [cat] } }, 'folder.create', 1)
      return cat.id
    },

    async updateCategory(id, changes) {
      const current = store.getState().categories.find((c) => c.id === id)
      if (!current) throw new Error(`updateCategory: no category ${id}`)
      await commit({ categories: { put: [touch(current, changes, clock)] } }, 'folder.update', 1)
    },

    // Deleting a category cascades: the category, its descendant categories, and
    // every event filed under any of them are all tombstoned together.
    async deleteCategory(id) {
      const s = store.getState()
      if (!s.categories.find((c) => c.id === id)) throw new Error(`deleteCategory: no category ${id}`)
      const ids = descendantCategoryIds(s.categories, id) // the category + its descendants
      const cats = s.categories.filter((c) => !c.deleted && ids.has(c.id)).map((c) => softDelete(c, clock))
      const events = s.events
        .filter((e) => !e.deleted && e.categoryId != null && ids.has(e.categoryId))
        .map((e) => softDelete(e, clock))
      await commit({ categories: { put: cats }, events: { put: events } }, 'folder.delete', events.length)
    },

    async moveCategory(id, parentId, beforeId = null) {
      const s = store.getState()
      if (!s.categories.find((c) => c.id === id)) throw new Error(`moveCategory: no category ${id}`)
      const changes = reorderedCategories(s.categories, id, parentId, beforeId)
      const written = changes.map((c) => touch(c, { parentId: c.parentId, order: c.order }, clock))
      await commit({ categories: { put: written } }, 'folder.move', 1)
    },

    async createTag(fields) {
      const name = fields.name.trim()
      const existing = store.getState().tags.find((t) => !t.deleted && t.name === name)
      if (existing) return existing.id
      const t: Tag = { id: genId(), name, color: fields.color ?? '#888888', updatedAt: clock.now(), deleted: false }
      await commit({ tags: { put: [t] } }, 'tag.create', 1)
      return t.id
    },

    async updateTag(id, changes) {
      const current = store.getState().tags.find((t) => t.id === id)
      if (!current) throw new Error(`updateTag: no tag ${id}`)
      await commit({ tags: { put: [touch(current, changes, clock)] } }, 'tag.update', 1)
    },

    // Deleting a tag takes it off every LIVE event in the same change. Left
    // behind, the dangling id kept the event out of "Untagged" and kept the
    // deleted name in the list's tag column. Events already in the recycle bin
    // keep it on purpose: restoring one revives its tags, as it was.
    async deleteTag(id) {
      const s = store.getState()
      const current = s.tags.find((t) => t.id === id)
      if (!current) throw new Error(`deleteTag: no tag ${id}`)
      const events = s.events
        .filter((e) => !e.deleted && e.tagIds.includes(id))
        .map((e) => touch(e, { tagIds: e.tagIds.filter((t) => t !== id) }, clock))
      await commit({ tags: { put: [softDelete(current, clock)] }, events: { put: events } }, 'tag.delete', events.length)
    },

    undo: () => travel(undoStack, redoStack),
    redo: () => travel(redoStack, undoStack),

    setFilter(patchFilter) {
      store.setState((s) => sanitize({ ...s, filter: { ...s.filter, ...patchFilter }, checkedIds: [] }))
    },
    resetFilter() {
      store.setState((s) => ({ ...s, filter: { ...EMPTY_FILTER, tagMode: s.filter.tagMode }, checkedIds: [], selectedId: null }))
    },
    select(id) {
      store.setState((s) => ({ ...s, selectedId: id }))
    },
    toggleChecked(id) {
      store.setState((s) => ({
        ...s,
        checkedIds: s.checkedIds.includes(id) ? s.checkedIds.filter((x) => x !== id) : [...s.checkedIds, id],
      }))
    },
    setChecked(ids) {
      store.setState((s) => ({ ...s, checkedIds: ids }))
    },
    setView(view) {
      // Selection is per-view: clearing it on a view switch keeps a row
      // selected in the list from popping the timeline's detail card (and
      // vice-versa) for something the user never picked in the new view.
      // The batch (checkbox) selection is list-only, so it clears too.
      store.setState((s) => (s.view === view ? s : { ...s, view, selectedId: null, checkedIds: [] }))
    },
    revealEvent(id) {
      store.setState((s) => ({ ...s, view: 'timeline', selectedId: id, reveal: id, checkedIds: [] }))
    },
    clearReveal() {
      store.setState((s) => (s.reveal === null ? s : { ...s, reveal: null }))
    },
    setSort(sort) {
      store.setState((s) => ({ ...s, sort }))
    },
    setThemeMode(mode, systemPrefersDark = false) {
      store.setState((s) => ({
        ...s,
        themeMode: mode,
        theme: mode === 'system' ? (systemPrefersDark ? 'night' : 'day') : mode,
      }))
    },
    setTheme(t) {
      store.setState((s) => (s.theme === t ? s : { ...s, theme: t }))
    },
    setLocale(l) {
      store.setState((s) => ({ ...s, locale: l }))
    },
    setNowYear(y) {
      nowYear = y
      store.setState((s) => ({ ...s, nowYear: y }))
    },
    setTimelineView(updater) {
      store.setState((s) => ({
        ...s,
        timelineView: typeof updater === 'function' ? updater(s.timelineView) : updater,
      }))
    },
    setTimelineOverview(updater) {
      store.setState((s) => ({
        ...s,
        timelineOverview: typeof updater === 'function' ? updater(s.timelineOverview) : updater,
      }))
    },
    setTimelineScale(updater) {
      store.setState((s) => ({
        ...s,
        timelineScale: typeof updater === 'function' ? updater(s.timelineScale) : updater,
      }))
    },
    setTimelineAxis(axis) {
      // A view is measured in the axis's own coordinate, so it cannot carry
      // over: switching starts from "fit everything" in the new geometry.
      store.setState((s) =>
        s.timelineAxis === axis ? s : { ...s, timelineAxis: axis, timelineView: null, timelineOverview: null },
      )
    },
    setTimelineLanes(on) {
      store.setState((s) => ({ ...s, timelineLanes: on }))
    },
  }
}
