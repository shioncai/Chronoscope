import { describe, it, expect } from 'vitest'
import { buildTransferFile } from './transfer'
import type { EventRecord, Category, Tag } from '../domain/model'
import { fromYear } from '../domain/time'

const cat = (id: string, name: string, extra: Partial<Category> = {}): Category =>
  ({ id, name, parentId: null, color: '#111111', order: 0, updatedAt: 't0', deleted: false, ...extra })
const tag = (id: string, name: string, extra: Partial<Tag> = {}): Tag =>
  ({ id, name, color: '#888888', updatedAt: 't0', deleted: false, ...extra })
const ev = (id: string, extra: Partial<EventRecord> = {}): EventRecord =>
  ({ id, title: id, note: '', categoryId: null, tagIds: [], links: [], createdAt: 't0',
     updatedAt: 't0', deleted: false, start: fromYear(2000, 'year'), ...extra })

describe('buildTransferFile', () => {
  it('wraps only non-deleted records in a versioned envelope', () => {
    const file = buildTransferFile(
      {
        events: [ev('e1'), ev('e2', { deleted: true })],
        categories: [cat('c1', 'A'), cat('c2', 'B', { deleted: true })],
        tags: [tag('t1', 'x'), tag('t2', 'y', { deleted: true })],
      },
      '2026-07-03T00:00:00.000Z',
    )
    expect(file.app).toBe('chronoscope')
    expect(file.version).toBe(1)
    expect(file.exportedAt).toBe('2026-07-03T00:00:00.000Z')
    expect(file.data.events.map((e) => e.id)).toEqual(['e1'])
    expect(file.data.categories.map((c) => c.id)).toEqual(['c1'])
    expect(file.data.tags.map((t) => t.id)).toEqual(['t1'])
  })

  it('keeps empty folders and unused tags (full live structure)', () => {
    const file = buildTransferFile(
      { events: [], categories: [cat('c1', 'Empty')], tags: [tag('t1', 'Unused')] },
      'now',
    )
    expect(file.data.categories).toHaveLength(1)
    expect(file.data.tags).toHaveLength(1)
  })
})
