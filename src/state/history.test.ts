import { describe, it, expect, beforeEach } from 'vitest'
import { createAppStore, type AppStore } from './appStore'
import { createMemoryRepository, type Database, type Clock } from '../data'
import { fromYear } from '../domain/time'
import type { EventRecord, Category, Tag } from '../domain/model'

let db: Database
let app: AppStore
beforeEach(() => {
  db = {
    events: createMemoryRepository<EventRecord>(),
    categories: createMemoryRepository<Category>(),
    tags: createMemoryRepository<Tag>(),
  }
  let t = 0
  let i = 0
  const clock: Clock = { now: () => `t${String(++t).padStart(4, '0')}` }
  app = createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
})
const state = () => app.store.getState()
const live = () => state().events.filter((e) => !e.deleted)

describe('undo / redo', () => {
  it('undoes a create by removing the record, memory and disk', async () => {
    const id = await app.createEvent({ title: 'a', start: fromYear(2000, 'year') })
    expect(state().history.undo).toEqual({ action: 'event.create', count: 1 })
    await app.undo()
    expect(state().events).toHaveLength(0)
    expect(await db.events.get(id)).toBeUndefined()
    expect(state().history.redo).toEqual({ action: 'event.create', count: 1 })
    await app.redo()
    expect(state().events.map((e) => e.id)).toEqual([id])
    expect(await db.events.get(id)).toBeDefined()
  })

  it('undoes an edit back to the previous content, with a fresh timestamp', async () => {
    const id = await app.createEvent({ title: 'a', start: fromYear(2000, 'year') })
    await app.updateEvent(id, { title: 'b' })
    const editedAt = state().events[0].updatedAt
    await app.undo()
    const e = state().events[0]
    expect(e.title).toBe('a')
    expect(e.updatedAt > editedAt).toBe(true) // newer than the edit it reverted
  })

  it('undoes a batch delete in one step and brings the selection back to life', async () => {
    const a = await app.createEvent({ title: 'a', start: fromYear(1, 'year') })
    const b = await app.createEvent({ title: 'b', start: fromYear(2, 'year') })
    await app.deleteEvents([a, b])
    expect(live()).toHaveLength(0)
    expect(state().history.undo).toEqual({ action: 'event.delete', count: 2 })
    await app.undo()
    expect(live().map((e) => e.id).sort()).toEqual([a, b])
  })

  it('undoes a folder delete — the folder and every cascaded event', async () => {
    const f = await app.createCategory({ name: 'F' })
    await app.createEvent({ title: 'a', start: fromYear(1, 'year'), categoryId: f })
    await app.deleteCategory(f)
    expect(state().categories[0].deleted).toBe(true)
    await app.undo()
    expect(state().categories[0].deleted).toBe(false)
    expect(live()).toHaveLength(1)
  })

  it('undoes a permanent delete by writing the record back', async () => {
    const a = await app.createEvent({ title: 'a', start: fromYear(1, 'year') })
    await app.deleteEvent(a)
    await app.purgeEvents([a])
    expect(state().events).toHaveLength(0)
    await app.undo()
    expect(state().events[0]).toMatchObject({ id: a, deleted: true })
    expect(await db.events.get(a)).toBeDefined()
  })

  it('a new change clears the redo stack', async () => {
    await app.createEvent({ title: 'a', start: fromYear(1, 'year') })
    await app.undo()
    expect(state().history.redo).not.toBeNull()
    await app.createEvent({ title: 'b', start: fromYear(1, 'year') })
    expect(state().history.redo).toBeNull()
  })

  it('reports nothing to do on an empty stack', async () => {
    expect(await app.undo()).toBeNull()
    expect(await app.redo()).toBeNull()
  })

  it('undoes an import as one step', async () => {
    const file = app.exportData()
    file.data.events.push({
      id: 'x', title: 'imported', start: fromYear(1500, 'year'), note: '', categoryId: null,
      tagIds: [], links: [], createdAt: 't', updatedAt: 't', deleted: false,
    })
    await app.importFile(file)
    expect(live()).toHaveLength(1)
    await app.undo()
    expect(live()).toHaveLength(0)
  })
})

describe('tags', () => {
  it('createTag returns the existing tag for a duplicate name', async () => {
    const a = await app.createTag({ name: 'travel' })
    const b = await app.createTag({ name: ' travel ' })
    expect(b).toBe(a)
    expect(state().tags).toHaveLength(1)
  })

  it('deleteTag takes the tag off live events, so they count as untagged again', async () => {
    const t = await app.createTag({ name: 'x' })
    const e = await app.createEvent({ title: 'a', start: fromYear(1, 'year'), tagIds: [t] })
    await app.deleteTag(t)
    expect(state().events.find((x) => x.id === e)?.tagIds).toEqual([])
    await app.undo() // one step restores both the tag and the reference
    expect(state().tags[0].deleted).toBe(false)
    expect(state().events.find((x) => x.id === e)?.tagIds).toEqual([t])
  })

  it('drops a deleted tag from the active filter', async () => {
    const t = await app.createTag({ name: 'x' })
    app.setFilter({ tagIds: [t] })
    await app.deleteTag(t)
    expect(state().filter.tagIds).toEqual([])
  })
})

describe('events', () => {
  it('duplicates an event under a new title in the same folder', async () => {
    const f = await app.createCategory({ name: 'F' })
    const id = await app.createEvent({ title: 'a', start: fromYear(1, 'year'), categoryId: f, note: 'n' })
    const copy = await app.duplicateEvent(id, 'a (2)')
    const e = state().events.find((x) => x.id === copy)!
    expect(e).toMatchObject({ title: 'a (2)', categoryId: f, note: 'n' })
    expect(e.id).not.toBe(id)
  })

  it('empties the recycle bin', async () => {
    const a = await app.createEvent({ title: 'a', start: fromYear(1, 'year') })
    await app.createEvent({ title: 'b', start: fromYear(1, 'year') })
    await app.deleteEvent(a)
    await app.emptyTrash()
    expect(state().events.map((e) => e.title)).toEqual(['b'])
  })

  it('drops the selection when the selected event leaves the current mode', async () => {
    const a = await app.createEvent({ title: 'a', start: fromYear(1, 'year') })
    app.select(a)
    await app.deleteEvent(a)
    expect(state().selectedId).toBeNull()
  })

  it('forgets a deleted folder in the scope', async () => {
    const f = await app.createCategory({ name: 'F' })
    app.setFilter({ scope: { folderIds: [f], includeEvents: [], excludeEvents: [] } })
    await app.deleteCategory(f)
    expect(state().filter.scope.folderIds).toEqual([])
  })
})

describe('session actions', () => {
  it('reveals an event on the timeline', async () => {
    const a = await app.createEvent({ title: 'a', start: fromYear(1, 'year') })
    app.revealEvent(a)
    expect(state()).toMatchObject({ view: 'timeline', selectedId: a, reveal: a })
    app.clearReveal()
    expect(state().reveal).toBeNull()
  })

  it('resets the timeline view when the axis changes', () => {
    app.setTimelineView({ min: 1, max: 2 })
    app.setTimelineAxis('log')
    expect(state().timelineAxis).toBe('log')
    expect(state().timelineView).toBeNull()
  })

  it('resolves a system theme mode against the OS', () => {
    app.setThemeMode('system', true)
    expect(state()).toMatchObject({ themeMode: 'system', theme: 'night' })
    app.setThemeMode('day')
    expect(state()).toMatchObject({ themeMode: 'day', theme: 'day' })
  })
})

describe('CSV', () => {
  it('round-trips events, folders and tags through a CSV file', async () => {
    const f = await app.createCategory({ name: 'Earth' })
    const sub = await app.createCategory({ name: 'Life', parentId: f })
    const t = await app.createTag({ name: 'milestone' })
    await app.createEvent({ title: 'Cambrian, "explosion"', start: { ago: 538e6, precision: 'Ma' }, categoryId: sub, tagIds: [t], note: 'line 1\nline 2' })
    const csv = app.exportCsv()

    const db2: Database = {
      events: createMemoryRepository<EventRecord>(),
      categories: createMemoryRepository<Category>(),
      tags: createMemoryRepository<Tag>(),
    }
    let n = 0
    const other = createAppStore({ db: db2, clock: { now: () => `u${++n}` }, nowYear: 2026, theme: 'day' })
    const out = await other.importData(csv, 'csv')
    expect(out.ok).toBe(true)
    const s = other.store.getState()
    const e = s.events[0]
    expect(e.title).toBe('Cambrian, "explosion"')
    expect(e.note).toBe('line 1\nline 2')
    expect(e.start).toEqual({ ago: 538e6, precision: 'Ma' })
    const life = s.categories.find((c) => c.id === e.categoryId)!
    expect(life.name).toBe('Life')
    expect(s.categories.find((c) => c.id === life.parentId)?.name).toBe('Earth')
    expect(s.tags.find((x) => x.id === e.tagIds[0])?.name).toBe('milestone')
  })

  it('counts rows it cannot read and refuses a file without a title column', async () => {
    const out = await app.importData('title,start\nok,1969\nbad,someday\n,1970\n', 'csv')
    expect(out).toMatchObject({ ok: true, summary: { addedEvents: 1, invalidEvents: 2 } })
    expect(await app.importData('a,b\n1,2', 'csv')).toEqual({ ok: false, error: 'csv-header' })
  })

  it('accepts Chinese headers', async () => {
    const out = await app.importData('标题,开始,文件夹\n秦统一,公元前221年,中国史\n', 'csv')
    expect(out).toMatchObject({ ok: true, summary: { addedEvents: 1, addedCategories: 1 } })
  })
})
