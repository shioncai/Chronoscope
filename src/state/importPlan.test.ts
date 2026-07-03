import { describe, it, expect } from 'vitest'
import { planRestore } from './importPlan'
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
