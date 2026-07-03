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
  it('rebuilds folders, tags and events into an empty store', () => {
    const { clock, genId } = fixtures()
    const incoming = {
      categories: [cat('fp', '历史'), cat('fc', '近代', 'fp')],
      tags: [tag('ft', '重要')],
      events: [ev('e1', { categoryId: 'fc', tagIds: ['ft'] })],
    }
    const r = planImport(empty, incoming, clock, genId)
    expect(r.summary.addedCategories).toBe(2)
    expect(r.summary.addedTags).toBe(1)
    expect(r.summary.addedEvents).toBe(1)
    const child = r.categories.find((c) => c.name === '近代')!
    const parent = r.categories.find((c) => c.name === '历史')!
    expect(child.parentId).toBe(parent.id)
    const outEvent = r.events[0]
    expect(outEvent.id).toBe('e1') // event id preserved
    expect(outEvent.categoryId).toBe(child.id)
    expect(outEvent.tagIds).toEqual([r.tags[0].id])
  })

  it('is idempotent: re-importing current data adds nothing', () => {
    const { clock, genId } = fixtures()
    const current = {
      categories: [cat('c', '历史')],
      tags: [tag('t', '重要')],
      events: [ev('e1', { categoryId: 'c', tagIds: ['t'] })],
    }
    // "file" is exactly the current data (same ids)
    const r = planImport(current, current, clock, genId)
    expect(r.summary).toMatchObject({ addedEvents: 0, skippedEvents: 1, addedCategories: 0, reusedCategories: 1, addedTags: 0, reusedTags: 1 })
    expect(r.events).toHaveLength(0) // nothing to write
    expect(r.categories).toHaveLength(0)
    expect(r.tags).toHaveLength(0)
  })

  it('reuses an existing same-name folder, existing color wins, no duplicate', () => {
    const { clock, genId } = fixtures()
    const current = { categories: [cat('local', '历史', null, { color: '#0000ff' })], tags: [], events: [] }
    const incoming = {
      categories: [cat('file', '历史', null, { color: '#ff0000' })],
      tags: [],
      events: [ev('e1', { categoryId: 'file' })],
    }
    const r = planImport(current, incoming, clock, genId)
    expect(r.summary.reusedCategories).toBe(1)
    expect(r.summary.addedCategories).toBe(0)
    expect(r.categories).toHaveLength(0) // reused the live folder, created nothing
    expect(r.events[0].categoryId).toBe('local') // homed into existing folder (its #0000ff color untouched)
  })

  it('skips events whose id already exists live', () => {
    const { clock, genId } = fixtures()
    const current = { categories: [], tags: [], events: [ev('e1', { title: 'local' })] }
    const incoming = { categories: [], tags: [], events: [ev('e1', { title: 'from-file' })] }
    const r = planImport(current, incoming, clock, genId)
    expect(r.summary.skippedEvents).toBe(1)
    expect(r.events).toHaveLength(0)
  })

  it('skips (never revives) an event whose id sits in the recycle bin', () => {
    const { clock, genId } = fixtures()
    const current = { categories: [], tags: [], events: [ev('e1', { title: 'local', deleted: true })] }
    const incoming = { categories: [], tags: [], events: [ev('e1', { title: 'from-file' })] }
    const r = planImport(current, incoming, clock, genId)
    // import and the recycle bin are independent: import never un-deletes
    expect(r.summary.skippedEvents).toBe(1)
    expect(r.events).toHaveLength(0) // the tombstone is left untouched
  })

  it('preserves inter-event links (ids kept)', () => {
    const { clock, genId } = fixtures()
    const incoming = {
      categories: [], tags: [],
      events: [ev('a', { links: ['b'] }), ev('b', { links: ['a'] })],
    }
    const r = planImport(empty, incoming, clock, genId)
    const a = r.events.find((e) => e.id === 'a')!
    const b = r.events.find((e) => e.id === 'b')!
    expect(a.links).toEqual(['b'])
    expect(b.links).toEqual(['a'])
  })

  it('drops invalid events and counts them', () => {
    const { clock, genId } = fixtures()
    const incoming = {
      categories: [], tags: [],
      events: [
        ev('ok'),
        { ...ev('noTitle'), title: '' },
        { ...ev('noTime'), start: undefined, end: undefined },
      ],
    }
    const r = planImport(empty, incoming, clock, genId)
    expect(r.summary.addedEvents).toBe(1)
    expect(r.summary.invalidEvents).toBe(2)
  })

  it('keeps empty folders and unused tags from the file', () => {
    const { clock, genId } = fixtures()
    const incoming = { categories: [cat('c', '空夹')], tags: [tag('t', '没用过')], events: [] }
    const r = planImport(empty, incoming, clock, genId)
    expect(r.categories.map((c) => c.name)).toEqual(['空夹'])
    expect(r.tags.map((t) => t.name)).toEqual(['没用过'])
  })
})
