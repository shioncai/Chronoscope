import {
  newEvent,
  touch,
  softDelete,
  type Database,
  type Clock,
  type NewEventFields,
} from '../data'
import type { EventRecord, Category, Tag, Id } from '../domain/model'
import type { LinearView } from '../domain/time'
import { migrateEventTimes } from '../domain/time'
import { createStore, type Store } from './store'
import { descendantCategoryIds } from './scope'
import { reorderedCategories } from './categoryOrder'
import { planRestore, planImport, type ImportSummary, type RestoreConflict } from './importPlan'
import { buildTransferFile, parseTransferFile, type TransferFile, type TransferError } from './transfer'
import { initialAppState, type AppState, type Filter, type Sort, type Theme, type View } from './types'
import type { Locale } from '../domain/locale'

export interface AppStoreDeps {
  db: Database
  clock: Clock
  nowYear: number
  theme: Theme
  locale?: Locale
  genId?: () => string
}

export type ImportOutcome =
  | { ok: true; summary: ImportSummary }
  | { ok: false; error: TransferError; version?: string }

export interface AppStore {
  store: Store<AppState>
  load(): Promise<void>
  exportData(): TransferFile
  importData(text: string): Promise<ImportOutcome>
  createEvent(fields: NewEventFields): Promise<Id>
  updateEvent(id: Id, changes: Partial<EventRecord>): Promise<void>
  deleteEvent(id: Id): Promise<void>
  deleteEvents(ids: Id[]): Promise<void>
  // Recycle bin: restore un-tombstones (soft), purge hard-deletes permanently.
  restoreEvents(ids: Id[], resolutions?: Record<Id, 'overwrite' | 'skip'>): Promise<{ conflicts: RestoreConflict[] }>
  purgeEvents(ids: Id[]): Promise<void>
  setEventsCategory(ids: Id[], categoryId: Id | null): Promise<void>
  addTagToEvents(ids: Id[], tagId: Id): Promise<void>
  removeTagFromEvents(ids: Id[], tagId: Id): Promise<void>
  createCategory(fields: { name: string; parentId?: Id | null; color?: string; order?: number }): Promise<Id>
  updateCategory(id: Id, changes: Partial<Category>): Promise<void>
  deleteCategory(id: Id): Promise<void>
  moveCategory(id: Id, parentId: Id | null, beforeId?: Id | null): Promise<void>
  createTag(fields: { name: string; color?: string }): Promise<Id>
  updateTag(id: Id, changes: Partial<Tag>): Promise<void>
  deleteTag(id: Id): Promise<void>
  setFilter(patch: Partial<Filter>): void
  select(id: Id | null): void
  toggleChecked(id: Id): void
  setChecked(ids: Id[]): void
  setView(view: View): void
  setSort(sort: Sort): void
  setTheme(theme: Theme): void
  setLocale(locale: Locale): void
  setTimelineView(updater: LinearView | ((prev: LinearView | null) => LinearView)): void
  setTimelineOverview(updater: LinearView | ((prev: LinearView | null) => LinearView)): void
  setTimelineScale(updater: number | ((prev: number) => number)): void
}

// replace the record with matching id, or append if new
function upsert<T extends { id: Id }>(list: T[], rec: T): T[] {
  const i = list.findIndex((x) => x.id === rec.id)
  if (i === -1) return [...list, rec]
  const copy = list.slice()
  copy[i] = rec
  return copy
}

// The same, for a whole batch, in ONE pass. Folding `upsert` over a batch is
// O(list × batch) — a find + a full array copy per record — which is what a
// bulk tag/move/delete over a large selection used to pay. Existing records
// keep their position; genuinely new ones are appended in batch order.
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

export function createAppStore(deps: AppStoreDeps): AppStore {
  const { db, clock, nowYear, theme, locale = 'zh' } = deps
  const genId = deps.genId ?? (() => crypto.randomUUID())
  const store = createStore<AppState>(initialAppState(nowYear, theme, locale))

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
    store.setState((s) => ({ ...s, events, categories, tags, loaded: true }))
  }

  // shared tail for the non-deleting batch mutators: persist the changed
  // records in one write, then upsert them all in one setState. No-op when
  // nothing changed.
  async function commitEvents(changed: EventRecord[]): Promise<void> {
    if (changed.length === 0) return
    await db.events.bulkPut(changed)
    store.setState((st) => ({ ...st, events: upsertMany(st.events, changed) }))
  }

  return {
    store,
    load,

    exportData() {
      const s = store.getState()
      return buildTransferFile(
        { events: s.events, categories: s.categories, tags: s.tags },
        new Date().toISOString(),
      )
    },

    async importData(text) {
      const parsed = parseTransferFile(text)
      if (!parsed.ok) return { ok: false, error: parsed.error, version: parsed.version }
      const s = store.getState()
      // migrate incoming deep-time points (v1 files store absolute years);
      // idempotent, so v2 files pass through unchanged
      const migratedEvents = parsed.file.data.events.map((e) => migrateEventTimes(e, nowYear) ?? e)
      const plan = planImport(
        { events: s.events, categories: s.categories, tags: s.tags },
        { ...parsed.file.data, events: migratedEvents },
        clock,
        genId,
      )
      await db.categories.bulkPut(plan.categories)
      await db.tags.bulkPut(plan.tags)
      await db.events.bulkPut(plan.events)
      store.setState((st) => ({
        ...st,
        categories: upsertMany(st.categories, plan.categories),
        tags: upsertMany(st.tags, plan.tags),
        events: upsertMany(st.events, plan.events),
      }))
      return { ok: true, summary: plan.summary }
    },

    async createEvent(fields) {
      const record = newEvent(fields, clock, genId)
      await db.events.put(record)
      store.setState((s) => ({ ...s, events: upsert(s.events, record) }))
      return record.id
    },

    async updateEvent(id, changes) {
      const current = store.getState().events.find((e) => e.id === id)
      if (!current) throw new Error(`updateEvent: no event ${id}`)
      const next = touch(current, changes, clock)
      await db.events.put(next)
      store.setState((s) => ({ ...s, events: upsert(s.events, next) }))
    },

    async deleteEvent(id) {
      const current = store.getState().events.find((e) => e.id === id)
      if (!current) throw new Error(`deleteEvent: no event ${id}`)
      const next = softDelete(current, clock)
      await db.events.put(next)
      store.setState((s) => ({
        ...s,
        events: upsert(s.events, next),
        selectedId: s.selectedId === id ? null : s.selectedId,
        // keep the batch (checkbox) selection coherent with what still exists
        checkedIds: s.checkedIds.filter((x) => x !== id),
      }))
    },

    async deleteEvents(ids) {
      const idSet = new Set(ids)
      const changed = store
        .getState()
        .events.filter((e) => !e.deleted && idSet.has(e.id))
        .map((e) => softDelete(e, clock))
      await db.events.bulkPut(changed)
      store.setState((st) => {
        const gone = new Set(changed.map((e) => e.id))
        return {
          ...st,
          events: upsertMany(st.events, changed),
          checkedIds: [], // the selection was just consumed
          selectedId: st.selectedId != null && gone.has(st.selectedId) ? null : st.selectedId,
        }
      })
    },

    async restoreEvents(ids, resolutions = {}) {
      const idSet = new Set(ids)
      const s0 = store.getState()
      // Restore un-tombstones each event and revives its full context (folder
      // ancestor chain + referenced tags). The planner merges by name/path
      // against live records, so if a same-name folder/tag already exists the
      // event re-homes into it (its color wins) instead of resurrecting a
      // duplicate. If the target folder already holds a live same-title event,
      // the event is held back as a conflict unless resolved via `resolutions`
      // ('overwrite' permanently removes the existing one — the restored event
      // wins completely; 'skip' leaves the restored event deleted).
      // Shared with import via src/state/importPlan.ts.
      const plan = planRestore(
        { events: s0.events, categories: s0.categories, tags: s0.tags },
        ids,
        clock,
        resolutions,
      )
      await db.categories.bulkPut(plan.categories)
      await db.tags.bulkPut(plan.tags)
      await db.events.bulkPut(plan.events)
      await db.events.bulkDelete(plan.purge)
      const purged = new Set(plan.purge)
      store.setState((st) => ({
        ...st,
        categories: upsertMany(st.categories, plan.categories),
        tags: upsertMany(st.tags, plan.tags),
        events: upsertMany(st.events.filter((e) => !purged.has(e.id)), plan.events),
        checkedIds: st.checkedIds.filter((x) => !idSet.has(x) && !purged.has(x)),
        selectedId: st.selectedId != null && purged.has(st.selectedId) ? null : st.selectedId,
      }))
      return { conflicts: plan.conflicts }
    },

    async purgeEvents(ids) {
      const idSet = new Set(ids)
      await db.events.bulkDelete([...idSet])
      store.setState((st) => ({
        ...st,
        events: st.events.filter((e) => !idSet.has(e.id)),
        checkedIds: st.checkedIds.filter((x) => !idSet.has(x)),
        selectedId: st.selectedId != null && idSet.has(st.selectedId) ? null : st.selectedId,
      }))
    },

    async setEventsCategory(ids, categoryId) {
      const idSet = new Set(ids)
      const changed = store
        .getState()
        .events.filter((e) => !e.deleted && idSet.has(e.id) && e.categoryId !== categoryId)
        .map((e) => touch(e, { categoryId }, clock))
      await commitEvents(changed)
    },

    async addTagToEvents(ids, tagId) {
      const idSet = new Set(ids)
      const changed = store
        .getState()
        .events.filter((e) => !e.deleted && idSet.has(e.id) && !e.tagIds.includes(tagId))
        .map((e) => touch(e, { tagIds: [...e.tagIds, tagId] }, clock))
      await commitEvents(changed)
    },

    async removeTagFromEvents(ids, tagId) {
      const idSet = new Set(ids)
      const changed = store
        .getState()
        .events.filter((e) => !e.deleted && idSet.has(e.id) && e.tagIds.includes(tagId))
        .map((e) => touch(e, { tagIds: e.tagIds.filter((t) => t !== tagId) }, clock))
      await commitEvents(changed)
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
      await db.categories.put(cat)
      store.setState((s) => ({ ...s, categories: upsert(s.categories, cat) }))
      return cat.id
    },

    async updateCategory(id, changes) {
      const current = store.getState().categories.find((c) => c.id === id)
      if (!current) throw new Error(`updateCategory: no category ${id}`)
      const next = touch(current, changes, clock)
      await db.categories.put(next)
      store.setState((s) => ({ ...s, categories: upsert(s.categories, next) }))
    },

    // Deleting a category cascades: the category, its descendant categories, and
    // every event filed under any of them are all tombstoned together.
    async deleteCategory(id) {
      const s = store.getState()
      if (!s.categories.find((c) => c.id === id)) throw new Error(`deleteCategory: no category ${id}`)
      const ids = descendantCategoryIds(s.categories, id) // the category + its descendants
      const cats = s.categories
        .filter((c) => !c.deleted && ids.has(c.id))
        .map((c) => softDelete(c, clock))
      const events = s.events
        .filter((e) => !e.deleted && e.categoryId != null && ids.has(e.categoryId))
        .map((e) => softDelete(e, clock))
      await db.categories.bulkPut(cats)
      await db.events.bulkPut(events)
      store.setState((st) => {
        const selectedDeleted = events.some((e) => e.id === st.selectedId)
        return {
          ...st,
          categories: upsertMany(st.categories, cats),
          events: upsertMany(st.events, events),
          selectedId: selectedDeleted ? null : st.selectedId,
        }
      })
    },

    async moveCategory(id, parentId, beforeId = null) {
      const s = store.getState()
      if (!s.categories.find((c) => c.id === id)) throw new Error(`moveCategory: no category ${id}`)
      const changes = reorderedCategories(s.categories, id, parentId, beforeId)
      if (changes.length === 0) return
      const written = changes.map((c) => touch(c, { parentId: c.parentId, order: c.order }, clock))
      await db.categories.bulkPut(written)
      store.setState((st) => ({ ...st, categories: upsertMany(st.categories, written) }))
    },

    async createTag(fields) {
      const t: Tag = {
        id: genId(),
        name: fields.name,
        color: fields.color ?? '#888888',
        updatedAt: clock.now(),
        deleted: false,
      }
      await db.tags.put(t)
      store.setState((s) => ({ ...s, tags: upsert(s.tags, t) }))
      return t.id
    },

    async updateTag(id, changes) {
      const current = store.getState().tags.find((t) => t.id === id)
      if (!current) throw new Error(`updateTag: no tag ${id}`)
      const next = touch(current, changes, clock)
      await db.tags.put(next)
      store.setState((s) => ({ ...s, tags: upsert(s.tags, next) }))
    },

    async deleteTag(id) {
      const current = store.getState().tags.find((t) => t.id === id)
      if (!current) throw new Error(`deleteTag: no tag ${id}`)
      const next = softDelete(current, clock)
      await db.tags.put(next)
      store.setState((s) => ({ ...s, tags: upsert(s.tags, next) }))
    },

    setFilter(patch) {
      store.setState((s) => ({ ...s, filter: { ...s.filter, ...patch }, checkedIds: [] }))
    },
    select(id) {
      store.setState((s) => ({ ...s, selectedId: id }))
    },
    toggleChecked(id) {
      store.setState((s) => ({
        ...s,
        checkedIds: s.checkedIds.includes(id)
          ? s.checkedIds.filter((x) => x !== id)
          : [...s.checkedIds, id],
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
      store.setState((s) => ({ ...s, view, selectedId: null, checkedIds: [] }))
    },
    setSort(sort) {
      store.setState((s) => ({ ...s, sort }))
    },
    setTheme(t) {
      store.setState((s) => ({ ...s, theme: t }))
    },
    setLocale(l) {
      store.setState((s) => ({ ...s, locale: l }))
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
  }
}
