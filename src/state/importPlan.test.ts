import { describe, it, expect } from 'vitest'
import { planRestore, planImport } from './importPlan'
import type { EventRecord, Category, Tag, Id } from '../domain/model'
import type { Clock } from '../data'
import { fromYear } from '../domain/time'

function fixtures() {
  let t = 0
  const clock: Clock = { now: () => `t${String(++t).padStart(4, '0')}` }
  let i = 0
  const genId = () => `g${++i}`
  return { clock, genId }
}
const cat = (id: string, name: string, parentId: Id | null = null, extra: Partial<Category> = {}): Category =>
  ({ id, name, parentId, color: '#111111', order: 0, updatedAt: 't0', deleted: false, ...extra })
const tag = (id: string, name: string, extra: Partial<Tag> = {}): Tag =>
  ({ id, name, color: '#888888', updatedAt: 't0', deleted: false, ...extra })
const ev = (id: string, extra: Partial<EventRecord> = {}): EventRecord =>
  ({ id, title: id, note: '', categoryId: null, tagIds: [], links: [], createdAt: 't0',
     updatedAt: 't0', deleted: false, start: fromYear(2000, 'year'), ...extra })

describe('planRestore', () => {
  it('revives the deleted folder chain of a restored event', () => {
    const { clock } = fixtures()
    const current = {
      categories: [cat('p', '历史', null, { deleted: true }), cat('c', '近代', 'p', { deleted: true })],
      tags: [],
      events: [ev('e', { categoryId: 'c', deleted: true })],
    }
    const plan = planRestore(current, ['e'], clock)
    expect(plan.events[0].deleted).toBe(false)
    expect(plan.events[0].categoryId).toBe('c')
    const revivedIds = plan.categories.map((c) => c.id).sort()
    expect(revivedIds).toEqual(['c', 'p'])
    expect(plan.categories.every((c) => !c.deleted)).toBe(true)
  })

  it('keeps an event in its still-live folder (delete-event-only)', () => {
    const { clock } = fixtures()
    const current = {
      categories: [cat('c', '历史')],
      tags: [],
      events: [ev('e', { categoryId: 'c', deleted: true })],
    }
    const plan = planRestore(current, ['e'], clock)
    expect(plan.events[0].categoryId).toBe('c')
    expect(plan.categories).toHaveLength(0) // nothing to revive
  })

  it('merges into an existing live same-name folder instead of reviving a duplicate', () => {
    const { clock } = fixtures()
    const current = {
      categories: [
        cat('old', '历史', null, { deleted: true, color: '#ff0000' }),
        cat('new', '历史', null, { color: '#0000ff' }), // live, different id/color
      ],
      tags: [],
      events: [ev('e', { categoryId: 'old', deleted: true })],
    }
    const plan = planRestore(current, ['e'], clock)
    expect(plan.events[0].categoryId).toBe('new') // re-homed into the live folder
    expect(plan.categories).toHaveLength(0) // the deleted 'old' is NOT revived
  })

  it('revives a soft-deleted tag, or merges into a live same-name tag', () => {
    const { clock } = fixtures()
    const current = {
      categories: [],
      tags: [tag('t', '重要', { deleted: true })],
      events: [ev('e', { tagIds: ['t'], deleted: true })],
    }
    const plan = planRestore(current, ['e'], clock)
    expect(plan.events[0].tagIds).toEqual(['t'])
    expect(plan.tags.map((t) => t.id)).toEqual(['t'])
    expect(plan.tags[0].deleted).toBe(false)
  })
})

const empty = { events: [], categories: [], tags: [] }

describe('planImport', () => {
  it('creates events with fresh ids into an empty store', () => {
    const { clock, genId } = fixtures()
    const incoming = {
      categories: [cat('fp', '历史'), cat('fc', '近代', 'fp')],
      tags: [tag('ft', '重要')],
      events: [ev('fe1', { title: '登月', categoryId: 'fc', tagIds: ['ft'] })],
    }
    const r = planImport(empty, incoming, clock, genId)
    expect(r.summary.addedEvents).toBe(1)
    const out = r.events[0]
    expect(out.id).not.toBe('fe1') // fresh local id (identity is name+folder, not id)
    expect(out.title).toBe('登月')
    expect(out.categoryId).toBe(r.categories.find((c) => c.name === '近代')!.id)
    expect(out.tagIds).toEqual([r.tags[0].id])
  })

  it('overwrites a live event with the same title+folder in place', () => {
    const { clock, genId } = fixtures()
    const current = {
      categories: [cat('f', '历史')],
      tags: [],
      events: [ev('local', { title: '登月', categoryId: 'f', note: 'old', start: fromYear(1969, 'year') })],
    }
    const incoming = {
      categories: [cat('ff', '历史')],
      tags: [],
      events: [ev('file', { title: '登月', categoryId: 'ff', note: 'new', start: fromYear(1969, 'year') })],
    }
    const r = planImport(current, incoming, clock, genId)
    expect(r.summary.overwrittenEvents).toBe(1)
    expect(r.summary.addedEvents).toBe(0)
    const out = r.events.find((e) => e.title === '登月')!
    expect(out.id).toBe('local') // kept existing id
    expect(out.note).toBe('new') // file attributes win on overwrite
  })

  it('leaves an identical live event unchanged (idempotent)', () => {
    const { clock, genId } = fixtures()
    const current = {
      categories: [cat('f', '历史')],
      tags: [],
      events: [ev('local', { title: '登月', categoryId: 'f', start: fromYear(1969, 'year') })],
    }
    const incoming = {
      categories: [cat('ff', '历史')],
      tags: [],
      events: [ev('file', { title: '登月', categoryId: 'ff', start: fromYear(1969, 'year') })],
    }
    const r = planImport(current, incoming, clock, genId)
    expect(r.summary).toMatchObject({ addedEvents: 0, overwrittenEvents: 0, unchangedEvents: 1 })
    expect(r.events).toHaveLength(0) // nothing written
  })

  it('ignores the recycle bin: a deleted same-name event does not block a fresh create', () => {
    const { clock, genId } = fixtures()
    const current = {
      categories: [cat('f', '历史')],
      tags: [],
      events: [ev('gone', { title: '登月', categoryId: 'f', deleted: true })],
    }
    const incoming = {
      categories: [cat('ff', '历史')],
      tags: [],
      events: [ev('file', { title: '登月', categoryId: 'ff' })],
    }
    const r = planImport(current, incoming, clock, genId)
    expect(r.summary.addedEvents).toBe(1) // created live; the tombstone is untouched
    const out = r.events.find((e) => !e.deleted)!
    expect(out.id).not.toBe('gone')
  })

  it('remaps inter-event links to local ids', () => {
    const { clock, genId } = fixtures()
    const incoming = {
      categories: [], tags: [],
      events: [ev('a', { title: 'A', links: ['b'] }), ev('b', { title: 'B', links: ['a'] })],
    }
    const r = planImport(empty, incoming, clock, genId)
    const a = r.events.find((e) => e.title === 'A')!
    const b = r.events.find((e) => e.title === 'B')!
    expect(a.links).toEqual([b.id])
    expect(b.links).toEqual([a.id])
    expect(a.links[0]).not.toBe('b') // remapped, not the file id
  })

  it('drops invalid events and counts them', () => {
    const { clock, genId } = fixtures()
    const incoming = {
      categories: [], tags: [],
      events: [ev('ok', { title: 'ok' }), { ...ev('bad', { title: '' }) }, { ...ev('bad2'), start: undefined, end: undefined }],
    }
    const r = planImport(empty, incoming, clock, genId)
    expect(r.summary.addedEvents).toBe(1)
    expect(r.summary.invalidEvents).toBe(2)
  })
})
