import { describe, it, expect } from 'vitest'
import { formatEventTime, buildEventCard } from './card'
import { ev, cat, tag, y } from '../../test/fixtures'

describe('formatEventTime', () => {
  it('formats a start–end range', () => {
    expect(formatEventTime(ev({ id: 'a', start: y(1900), end: y(2000) }))).toContain('–')
  })
  it('formats a point (start only) with no dash', () => {
    expect(formatEventTime(ev({ id: 'a', start: y(1969) }))).not.toContain('–')
  })
  it('formats an end-only event with an arrow', () => {
    expect(formatEventTime(ev({ id: 'a', end: y(1969) }))).toContain('→')
  })
  it('returns a dash when there is no time', () => {
    expect(formatEventTime(ev({ id: 'a' }))).toBe('—')
  })
  it('formats the event time in English', () => {
    expect(formatEventTime(ev({ id: 'e', start: y(-2999) }), 'en')).toBe('3000 BCE')
  })
})

describe('buildEventCard', () => {
  it('resolves category, tags, and links by id (skipping deleted/missing)', () => {
    const target = ev({ id: 'b', title: '链接目标' })
    const e = ev({
      id: 'a', title: '主', start: y(2000),
      categoryId: 'c1', tagIds: ['t1', 'gone'], links: ['b', 'missing'], note: '**记**',
    })
    const data = buildEventCard(e, {
      categories: [cat({ id: 'c1', name: '历史' })],
      tags: [tag({ id: 't1', name: '战争' })],
      events: [e, target],
    })
    expect(data.title).toBe('主')
    expect(data.note).toBe('**记**')
    expect(data.categoryName).toBe('历史')
    expect(data.tagNames).toEqual(['战争'])
    expect(data.links).toEqual([{ id: 'b', title: '链接目标' }])
  })
  it('reports a null category when uncategorized', () => {
    const data = buildEventCard(ev({ id: 'a', start: y(1) }), { categories: [], tags: [], events: [] })
    expect(data.categoryName).toBeNull()
  })
})
