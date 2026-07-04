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
import { descendantCategoryIds } from './selectors'
import { reorderedCategories } from './categoryOrder'
import { planRestore, planImport, type ImportSummary, type RestoreConflict } from './importPlan'
import { buildTransferFile, parseTransferFile, type TransferFile } from './transfer'
import { initialAppState, type AppState, type Filter, type Sort, type Theme, type View } from './types'

export interface AppStoreDeps {
  db: Database
  clock: Clock
  nowYear: number
  theme: Theme
  genId?: () => string
}

export type ImportOutcome =
  | { ok: true; summary: ImportSummary }
  | { ok: false; error: string }

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

export function createAppStore(deps: AppStoreDeps): AppStore {
  const { db, clock, nowYear, theme } = deps
  const genId = deps.genId ?? (() => crypto.randomUUID())
  const store = createStore<AppState>(initialAppState(nowYear, theme))

  async function load(): Promise<void> {
    const [rawEvents, categories, tags] = await Promise.all([
      db.events.getAll(),
      db.categories.getAll(),
      db.tags.getAll(),
    ])
    // one-time, idempotent: convert legacy absolute-stored deep-time points to
    // ago offsets and persist the change, so exports stay clean and it happens once
    const events = rawEvents.map((e) => migrateEventTimes(e, nowYear) ?? e)
    for (let i = 0; i < rawEvents.length; i++) {
      if (events[i] !== rawEvents[i]) await db.events.put(events[i])
    }
    store.setState((s) => ({ ...s, events, categories, tags, loaded: true }))
  }

  // shared tail for the non-deleting batch mutators: persist each changed
  // record, then upsert them all in one setState. No-op when nothing changed.
  async function commitEvents(changed: EventRecord[]): Promise<void> {
    if (changed.length === 0) return
    for (const e of changed) await db.events.put(e)
    store.setState((st) => {
      let evs = st.events
      for (const e of changed) evs = upsert(evs, e)
      return { ...st, events: evs }
    })
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
      if (!parsed.ok) return { ok: false, error: parsed.error }
      const s = store.getState()
      const plan = planImport(
        { events: s.events, categories: s.categories, tags: s.tags },
        parsed.file.data,
        clock,
        genId,
      )
      for (const c of plan.categories) await db.categories.put(c)
      for (const t of plan.tags) await db.tags.put(t)
      for (const e of plan.events) await db.events.put(e)
      store.setState((st) => {
        let cats = st.categories
        for (const c of plan.categories) cats = upsert(cats, c)
        let tags = st.tags
        for (const t of plan.tags) tags = upsert(tags, t)
        let evs = st.events
        for (const e of plan.events) evs = upsert(evs, e)
        return { ...st, categories: cats, tags, events: evs }
      })
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
      for (const e of changed) await db.events.put(e)
      store.setState((st) => {
        let evs = st.events
        for (const e of changed) evs = upsert(evs, e)
        const gone = new Set(changed.map((e) => e.id))
        return {
          ...st,
          events: evs,
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
      for (const c of plan.categories) await db.categories.put(c)
      for (const t of plan.tags) await db.tags.put(t)
      for (const e of plan.events) await db.events.put(e)
      for (const id of plan.purge) await db.events.delete(id)
      const purged = new Set(plan.purge)
      store.setState((st) => {
        let cats = st.categories
        for (const c of plan.categories) cats = upsert(cats, c)
        let tags = st.tags
        for (const t of plan.tags) tags = upsert(tags, t)
        let evs = st.events.filter((e) => !purged.has(e.id))
        for (const e of plan.events) evs = upsert(evs, e)
        return {
          ...st,
          categories: cats,
          tags,
          events: evs,
          checkedIds: st.checkedIds.filter((x) => !idSet.has(x) && !purged.has(x)),
          selectedId: st.selectedId != null && purged.has(st.selectedId) ? null : st.selectedId,
        }
      })
      return { conflicts: plan.conflicts }
    },

    async purgeEvents(ids) {
      const idSet = new Set(ids)
      for (const id of idSet) await db.events.delete(id)
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
      const cats: Category[] = []
      for (const c of s.categories) {
        if (!c.deleted && ids.has(c.id)) {
          const next = softDelete(c, clock)
          await db.categories.put(next)
          cats.push(next)
        }
      }
      const events: EventRecord[] = []
      for (const e of s.events) {
        if (!e.deleted && e.categoryId != null && ids.has(e.categoryId)) {
          const next = softDelete(e, clock)
          await db.events.put(next)
          events.push(next)
        }
      }
      store.setState((st) => {
        let categories = st.categories
        for (const c of cats) categories = upsert(categories, c)
        let evs = st.events
        for (const e of events) evs = upsert(evs, e)
        const selectedDeleted = events.some((e) => e.id === st.selectedId)
        return { ...st, categories, events: evs, selectedId: selectedDeleted ? null : st.selectedId }
      })
    },

    async moveCategory(id, parentId, beforeId = null) {
      const s = store.getState()
      if (!s.categories.find((c) => c.id === id)) throw new Error(`moveCategory: no category ${id}`)
      const changes = reorderedCategories(s.categories, id, parentId, beforeId)
      if (changes.length === 0) return
      const written: Category[] = []
      for (const c of changes) {
        const next = touch(c, { parentId: c.parentId, order: c.order }, clock)
        await db.categories.put(next)
        written.push(next)
      }
      store.setState((st) => {
        let categories = st.categories
        for (const c of written) categories = upsert(categories, c)
        return { ...st, categories }
      })
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
