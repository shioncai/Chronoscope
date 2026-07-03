import { describe, it, expect, beforeEach } from 'vitest'
import { createAppStore, type AppStore } from './appStore'
import { createMemoryRepository, type Database } from '../data'
import type { Clock } from '../data'
import type { EventRecord, Category, Tag } from '../domain/model'
import { fromYear } from '../domain/time'
import { visibleEvents } from './selectors'

function makeDb(): Database {
  return {
    events: createMemoryRepository<EventRecord>(),
    categories: createMemoryRepository<Category>(),
    tags: createMemoryRepository<Tag>(),
  }
}

// deterministic monotonically-increasing clock + id generator
function fixtures() {
  let t = 0
  const clock: Clock = { now: () => `t${String(++t).padStart(4, '0')}` }
  let i = 0
  const genId = () => `id${++i}`
  return { clock, genId }
}

let app: AppStore
let db: Database

beforeEach(() => {
  db = makeDb()
  const { clock, genId } = fixtures()
  app = createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId })
})

describe('appStore', () => {
  it('createEvent persists, stamps, and appears in state', async () => {
    const id = await app.createEvent({ title: '登月', start: fromYear(1969, 'year') })
    expect(id).toBe('id1')
    const inDb = await db.events.get('id1')
    expect(inDb?.title).toBe('登月')
    expect(inDb?.updatedAt).toBe('t0001')
    expect(app.store.getState().events.map((e) => e.id)).toEqual(['id1'])
  })

  it('load reads existing records (incl. tombstones) into state', async () => {
    await db.events.put({ id: 'x', title: 'x', note: '', categoryId: null, tagIds: [], links: [], createdAt: 't0', updatedAt: 't0', deleted: true })
    await app.load()
    const s = app.store.getState()
    expect(s.loaded).toBe(true)
    expect(s.events.map((e) => e.id)).toEqual(['x']) // tombstone present in raw state
    expect(visibleEvents(s)).toEqual([]) // but hidden by the selector
  })

  it('updateEvent applies changes and bumps updatedAt', async () => {
    await app.createEvent({ title: 'a' })
    await app.updateEvent('id1', { title: 'b' })
    expect((await db.events.get('id1'))?.title).toBe('b')
    expect(app.store.getState().events[0].title).toBe('b')
    expect(app.store.getState().events[0].updatedAt).toBe('t0002')
  })

  it('deleteEvent tombstones the record (kept in state, hidden by selector)', async () => {
    await app.createEvent({ title: 'a' })
    await app.deleteEvent('id1')
    expect((await db.events.get('id1'))?.deleted).toBe(true)
    expect(visibleEvents(app.store.getState())).toEqual([])
  })

  it('deleteEvent clears selectedId when it points at the deleted event', async () => {
    await app.createEvent({ title: 'a' })
    app.select('id1')
    await app.deleteEvent('id1')
    expect(app.store.getState().selectedId).toBeNull()
  })

  it('createCategory stamps and stores', async () => {
    const id = await app.createCategory({ name: '科技', parentId: null, color: '#0aa' })
    const c = await db.categories.get(id)
    expect(c).toMatchObject({ name: '科技', parentId: null, color: '#0aa', deleted: false })
    expect(c?.updatedAt).toBe('t0001')
    expect(app.store.getState().categories.map((x) => x.id)).toEqual([id])
  })

  it('createTag stamps and stores', async () => {
    const id = await app.createTag({ name: '里程碑' })
    expect((await db.tags.get(id))?.name).toBe('里程碑')
    expect(app.store.getState().tags.map((x) => x.id)).toEqual([id])
  })

  it('deleteCategory cascades to descendant categories and their events', async () => {
    const parent = await app.createCategory({ name: '历史' })
    const child = await app.createCategory({ name: '近代', parentId: parent })
    const e1 = await app.createEvent({ title: 'a', categoryId: parent })
    const e2 = await app.createEvent({ title: 'b', categoryId: child })
    const other = await app.createEvent({ title: 'c' }) // uncategorized → survives
    app.select(e2)
    await app.deleteCategory(parent)
    const s = app.store.getState()
    expect(s.categories.find((c) => c.id === parent)?.deleted).toBe(true)
    expect(s.categories.find((c) => c.id === child)?.deleted).toBe(true)
    expect(s.events.find((e) => e.id === e1)?.deleted).toBe(true)
    expect(s.events.find((e) => e.id === e2)?.deleted).toBe(true)
    expect(s.events.find((e) => e.id === other)?.deleted).toBe(false)
    expect(s.selectedId).toBeNull() // selection on a cascaded event is cleared
    expect((await db.events.get(e2))?.deleted).toBe(true) // persisted, not just in-memory
  })

  it('setters update only their slice and notify', async () => {
    const seen: number[] = []
    app.store.subscribe(() => seen.push(1))
    app.setFilter({ query: 'moon' })
    app.setView('timeline')
    app.select('id1') // after setView, which clears selection
    app.setSort({ key: 'title', dir: 'desc' })
    app.setTheme('night')
    const s = app.store.getState()
    expect(s.filter.query).toBe('moon')
    expect(s.selectedId).toBe('id1')
    expect(s.view).toBe('timeline')
    expect(s.sort).toEqual({ key: 'title', dir: 'desc' })
    expect(s.theme).toBe('night')
    expect(seen.length).toBe(5)
  })

  it('setView clears the selection so a view switch does not carry a stale detail card', () => {
    app.select('id1')
    expect(app.store.getState().selectedId).toBe('id1')
    app.setView('timeline')
    expect(app.store.getState().selectedId).toBeNull()
  })

  it('setTimelineView stores a value and supports functional updates', () => {
    expect(app.store.getState().timelineView).toBeNull()
    app.setTimelineView({ min: 0, max: 100 })
    expect(app.store.getState().timelineView).toEqual({ min: 0, max: 100 })
    app.setTimelineView((prev) => ({ min: prev!.min, max: prev!.max + 50 }))
    expect(app.store.getState().timelineView).toEqual({ min: 0, max: 150 })
  })

  it('setTimelineOverview supports a functional update starting from null', () => {
    expect(app.store.getState().timelineOverview).toBeNull()
    app.setTimelineOverview((prev) => (prev ? prev : { min: -10, max: 10 }))
    expect(app.store.getState().timelineOverview).toEqual({ min: -10, max: 10 })
  })

  it('moveCategory reparents a category under another', async () => {
    const a = await app.createCategory({ name: 'A' })
    const b = await app.createCategory({ name: 'B' })
    await app.moveCategory(b, a)
    expect(app.store.getState().categories.find((c) => c.id === b)?.parentId).toBe(a)
  })

  it('moveCategory promotes a child to top-level', async () => {
    const a = await app.createCategory({ name: 'A' })
    const b = await app.createCategory({ name: 'B', parentId: a })
    await app.moveCategory(b, null)
    expect(app.store.getState().categories.find((c) => c.id === b)?.parentId).toBeNull()
  })

  it('moveCategory refuses to move a category into its own descendant (no cycle)', async () => {
    const a = await app.createCategory({ name: 'A' })
    const b = await app.createCategory({ name: 'B', parentId: a })
    await app.moveCategory(a, b) // would make A a child of its own descendant
    expect(app.store.getState().categories.find((c) => c.id === a)?.parentId).toBeNull()
  })

  it('toggleChecked adds then removes an id', () => {
    app.toggleChecked('id1')
    expect(app.store.getState().checkedIds).toEqual(['id1'])
    app.toggleChecked('id2')
    expect(app.store.getState().checkedIds).toEqual(['id1', 'id2'])
    app.toggleChecked('id1')
    expect(app.store.getState().checkedIds).toEqual(['id2'])
  })

  it('setChecked replaces the whole selection', () => {
    app.toggleChecked('id1')
    app.setChecked(['a', 'b'])
    expect(app.store.getState().checkedIds).toEqual(['a', 'b'])
    app.setChecked([])
    expect(app.store.getState().checkedIds).toEqual([])
  })

  it('setView and setFilter clear the checked selection; select does not', () => {
    app.setChecked(['id1'])
    app.setView('timeline')
    expect(app.store.getState().checkedIds).toEqual([])

    app.setChecked(['id1'])
    app.setFilter({ query: 'x' })
    expect(app.store.getState().checkedIds).toEqual([])

    app.setChecked(['id1'])
    app.select('id1')
    expect(app.store.getState().checkedIds).toEqual(['id1'])
  })

  it('initial checkedIds is empty', () => {
    expect(app.store.getState().checkedIds).toEqual([])
  })

  it('deleteEvents tombstones all given events, clears selection and checkedIds', async () => {
    await app.createEvent({ title: 'a' }) // id1
    await app.createEvent({ title: 'b' }) // id2
    await app.createEvent({ title: 'c' }) // id3
    app.select('id2')
    app.setChecked(['id1', 'id2'])
    await app.deleteEvents(['id1', 'id2'])
    expect((await db.events.get('id1'))?.deleted).toBe(true)
    expect((await db.events.get('id2'))?.deleted).toBe(true)
    expect((await db.events.get('id3'))?.deleted).toBe(false)
    expect(app.store.getState().checkedIds).toEqual([])
    expect(app.store.getState().selectedId).toBeNull()
  })

  it('setEventsCategory sets the category (null = uncategorized) and keeps checkedIds', async () => {
    await app.createEvent({ title: 'a' }) // id1
    await app.createEvent({ title: 'b' }) // id2
    app.setChecked(['id1', 'id2'])
    await app.setEventsCategory(['id1', 'id2'], 'cat9')
    expect((await db.events.get('id1'))?.categoryId).toBe('cat9')
    expect((await db.events.get('id2'))?.categoryId).toBe('cat9')
    expect(app.store.getState().checkedIds).toEqual(['id1', 'id2'])
    await app.setEventsCategory(['id1'], null)
    expect((await db.events.get('id1'))?.categoryId).toBeNull()
  })

  it('addTagToEvents unions the tag without duplicating', async () => {
    await app.createEvent({ title: 'a' }) // id1
    await app.createEvent({ title: 'b' }) // id2
    await app.addTagToEvents(['id1', 'id2'], 'tagX')
    await app.addTagToEvents(['id1'], 'tagX') // already has it → no dup
    expect((await db.events.get('id1'))?.tagIds).toEqual(['tagX'])
    expect((await db.events.get('id2'))?.tagIds).toEqual(['tagX'])
  })

  it('removeTagFromEvents drops the tag where present', async () => {
    await app.createEvent({ title: 'a' }) // id1
    await app.addTagToEvents(['id1'], 'tagX')
    await app.addTagToEvents(['id1'], 'tagY')
    await app.removeTagFromEvents(['id1'], 'tagX')
    expect((await db.events.get('id1'))?.tagIds).toEqual(['tagY'])
  })

  it('batch ops on empty ids are a no-op (no throw, no write)', async () => {
    await app.createEvent({ title: 'a' }) // id1
    await app.setEventsCategory([], 'cat9')
    await app.addTagToEvents([], 'tagX')
    await app.removeTagFromEvents([], 'tagX')
    expect((await db.events.get('id1'))?.categoryId).toBeNull()
    expect((await db.events.get('id1'))?.tagIds).toEqual([])
  })

  it('deleteEvent removes the id from checkedIds too', async () => {
    await app.createEvent({ title: 'a' }) // id1
    await app.createEvent({ title: 'b' }) // id2
    app.setChecked(['id1', 'id2'])
    await app.deleteEvent('id1')
    expect(app.store.getState().checkedIds).toEqual(['id2'])
  })

  it('deleteEvents([]) still clears the checked selection', async () => {
    app.setChecked(['id1'])
    await app.deleteEvents([])
    expect(app.store.getState().checkedIds).toEqual([])
  })

  it('restoreEvents un-tombstones deleted events and drops them from checkedIds', async () => {
    await app.createEvent({ title: 'a' }) // id1
    await app.deleteEvent('id1')
    expect(app.store.getState().events.find((e) => e.id === 'id1')?.deleted).toBe(true)
    app.setChecked(['id1'])
    await app.restoreEvents(['id1'])
    expect(app.store.getState().events.find((e) => e.id === 'id1')?.deleted).toBe(false)
    expect(app.store.getState().checkedIds).toEqual([])
  })

  it('restoreEvents also restores the deleted folder chain of a restored event', async () => {
    const parent = await app.createCategory({ name: '历史' })
    const child = await app.createCategory({ name: '近代', parentId: parent })
    const e = await app.createEvent({ title: 'a', categoryId: child })
    await app.deleteCategory(parent) // cascades: parent + child + event all tombstoned
    expect(app.store.getState().categories.find((c) => c.id === parent)?.deleted).toBe(true)
    await app.restoreEvents([e])
    const s = app.store.getState()
    expect(s.events.find((x) => x.id === e)?.deleted).toBe(false)
    expect(s.categories.find((c) => c.id === child)?.deleted).toBe(false) // owning folder
    expect(s.categories.find((c) => c.id === parent)?.deleted).toBe(false) // ancestor chain
    expect((await db.categories.get(parent))?.deleted).toBe(false) // persisted, not just in-memory
  })

  it('restoreEvents also revives a soft-deleted tag the restored event references', async () => {
    const t = await app.createTag({ name: '重要' })
    const e = await app.createEvent({ title: 'a', tagIds: [t] })
    await app.deleteEvent(e) // event → recycle bin
    await app.deleteTag(t) // tag has 0 live users now → user cleans it up
    expect(app.store.getState().tags.find((x) => x.id === t)?.deleted).toBe(true)
    await app.restoreEvents([e])
    const s = app.store.getState()
    expect(s.events.find((x) => x.id === e)?.deleted).toBe(false)
    expect(s.tags.find((x) => x.id === t)?.deleted).toBe(false) // tag revived with the event
    expect((await db.tags.get(t))?.deleted).toBe(false) // persisted, not just in-memory
  })

  it('restoreEvents merges into an existing live same-name folder (no duplicate)', async () => {
    const gone = await app.createCategory({ name: '历史', color: '#ff0000' }) // id1
    const e = await app.createEvent({ title: 'a', categoryId: gone })          // id2
    await app.deleteCategory(gone) // cascades: folder + event tombstoned
    const live = await app.createCategory({ name: '历史', color: '#0000ff' })  // id3, new live same-name
    await app.restoreEvents([e])
    const s = app.store.getState()
    // event re-homed into the live folder, adopting it (existing color wins)
    expect(s.events.find((x) => x.id === e)?.categoryId).toBe(live)
    // the old deleted folder stays deleted — no duplicate live "历史"
    expect(s.categories.filter((c) => !c.deleted && c.name === '历史').map((c) => c.id)).toEqual([live])
    expect(s.categories.find((c) => c.id === gone)?.deleted).toBe(true)
  })

  it('deleting the only event using a tag keeps the tag (shows count 0, not removed)', async () => {
    const t = await app.createTag({ name: '孤标签' })
    const e = await app.createEvent({ title: 'a', tagIds: [t] })
    await app.deleteEvent(e)
    const s = app.store.getState()
    expect(s.tags.find((x) => x.id === t)?.deleted).toBe(false) // tag persists, mirrors a folder at count 0
    expect(s.events.filter((ev) => !ev.deleted && ev.tagIds.includes(t)).length).toBe(0)
  })

  it('purgeEvents permanently removes events from state and the repository', async () => {
    await app.createEvent({ title: 'a' }) // id1
    await app.deleteEvent('id1')
    await app.purgeEvents(['id1'])
    expect(app.store.getState().events.find((e) => e.id === 'id1')).toBeUndefined()
    expect(await db.events.get('id1')).toBeUndefined()
  })
})
