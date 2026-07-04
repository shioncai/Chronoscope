import { describe, it, expect } from 'vitest'
import { buildTransferFile, parseTransferFile } from './transfer'
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
    expect(file.version).toBe(2)
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

describe('parseTransferFile', () => {
  const good = JSON.stringify({
    app: 'chronoscope', version: 1, exportedAt: 'now',
    data: { events: [], categories: [], tags: [] },
  })

  it('accepts a well-formed file', () => {
    const r = parseTransferFile(good)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.file.data.events).toEqual([])
  })

  it('rejects invalid JSON', () => {
    const r = parseTransferFile('{not json')
    expect(r).toEqual({ ok: false, error: '文件已损坏或不是有效的 JSON' })
  })

  it('rejects a foreign file (wrong app)', () => {
    const r = parseTransferFile(JSON.stringify({ app: 'other', version: 1, data: {} }))
    expect(r).toEqual({ ok: false, error: '这不是 Chronoscope 导出文件' })
  })

  it('accepts a v1 file (migrated on import)', () => {
    const r = parseTransferFile(JSON.stringify({ app: 'chronoscope', version: 1, exportedAt: '', data: { events: [], categories: [], tags: [] } }))
    expect(r.ok).toBe(true)
  })

  it('accepts a v2 file', () => {
    const r = parseTransferFile(JSON.stringify({ app: 'chronoscope', version: 2, exportedAt: '', data: { events: [], categories: [], tags: [] } }))
    expect(r.ok).toBe(true)
  })

  it('rejects an unsupported version', () => {
    const r = parseTransferFile(JSON.stringify({ app: 'chronoscope', version: 9, data: {} }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('不支持的文件版本')
  })

  it('rejects missing data arrays', () => {
    const r = parseTransferFile(JSON.stringify({ app: 'chronoscope', version: 1, data: { events: [] } }))
    expect(r).toEqual({ ok: false, error: '文件内容不完整或已损坏' })
  })

  it('round-trips buildTransferFile output', () => {
    const built = buildTransferFile(
      { events: [ev('e1')], categories: [cat('c1', 'A')], tags: [tag('t1', 'x')] },
      'now',
    )
    const r = parseTransferFile(JSON.stringify(built))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.file.data.events[0].id).toBe('e1')
      expect(r.file.data.categories[0].name).toBe('A')
      expect(r.file.data.tags[0].name).toBe('x')
    }
  })
})
