import { describe, it, expect } from 'vitest'
import {
  buildCategoryTree,
  categoryEventCounts,
  visibleEvents,
  flattenCategoryTree,
  untaggedCount,
  deletedCount,
} from './selectors'
import { initialAppState, type AppState } from './types'
import { ev, cat, tag, y } from '../test/fixtures'

// helper to build a state with overrides
function st(over: Partial<AppState>): AppState {
  return { ...initialAppState(2026, 'day'), ...over }
}

describe('categoryEventCounts', () => {
  it('counts live events per category, including descendants', () => {
    const cats = [cat({ id: 'p' }), cat({ id: 'c', parentId: 'p' })]
    const events = [
      ev({ id: 'a', categoryId: 'p', start: y(1) }),
      ev({ id: 'b', categoryId: 'c', start: y(2) }),
      ev({ id: 'd', categoryId: 'c', start: y(3), deleted: true }), // tombstone ignored
      ev({ id: 'e', categoryId: null, start: y(4) }), // uncategorized ignored
    ]
    const counts = categoryEventCounts(st({ categories: cats, events }))
    expect(counts.get('p')).toBe(2) // a (direct) + b (in subcategory)
    expect(counts.get('c')).toBe(1)
  })
})

describe('buildCategoryTree', () => {
  it('nests by parentId and sorts each level by order', () => {
    const cats = [
      cat({ id: 'a', order: 1 }),
      cat({ id: 'b', order: 0 }),
      cat({ id: 'a1', parentId: 'a', order: 0 }),
    ]
    const tree = buildCategoryTree(cats)
    expect(tree.map((n) => n.category.id)).toEqual(['b', 'a']) // order 0 before 1
    expect(tree[1].children.map((n) => n.category.id)).toEqual(['a1'])
  })
})

describe('visibleEvents', () => {
  it('excludes tombstones', () => {
    const s = st({ events: [ev({ id: 'a', start: y(1) }), ev({ id: 'b', start: y(2), deleted: true })] })
    expect(visibleEvents(s).map((e) => e.id)).toEqual(['a'])
  })
  it('filters by category including descendants', () => {
    const s = st({
      categories: [cat({ id: 'p' }), cat({ id: 'c', parentId: 'p' })],
      events: [ev({ id: 'a', categoryId: 'c', start: y(1) }), ev({ id: 'b', categoryId: null, start: y(2) })],
      filter: { categoryId: 'p', tagIds: [], tagMode: 'or', query: '' },
    })
    expect(visibleEvents(s).map((e) => e.id)).toEqual(['a'])
  })
  it('uncategorized filter shows only events without a category', () => {
    const s = st({
      categories: [cat({ id: 'c' })],
      events: [ev({ id: 'a', categoryId: 'c', start: y(1) }), ev({ id: 'b', categoryId: null, start: y(2) })],
      filter: { categoryId: null, uncategorized: true, tagIds: [], tagMode: 'or', query: '' },
    })
    expect(visibleEvents(s).map((e) => e.id)).toEqual(['b'])
  })
  it('filters tags with AND vs OR', () => {
    const events = [
      ev({ id: 'a', tagIds: ['t1', 't2'], start: y(1) }),
      ev({ id: 'b', tagIds: ['t1'], start: y(2) }),
    ]
    const or = st({ events, filter: { categoryId: null, tagIds: ['t1', 't2'], tagMode: 'or', query: '' } })
    expect(visibleEvents(or).map((e) => e.id).sort()).toEqual(['a', 'b'])
    const and = st({ events, filter: { categoryId: null, tagIds: ['t1', 't2'], tagMode: 'and', query: '' } })
    expect(visibleEvents(and).map((e) => e.id)).toEqual(['a'])
  })
  it('filters by case-insensitive query over title and note', () => {
    const s = st({
      events: [ev({ id: 'a', title: '登月', note: 'Apollo', start: y(1) }), ev({ id: 'b', title: 'x', note: 'y', start: y(2) })],
      filter: { categoryId: null, tagIds: [], tagMode: 'or', query: 'apollo' },
    })
    expect(visibleEvents(s).map((e) => e.id)).toEqual(['a'])
  })
  it('sorts by start ascending, events without start last', () => {
    const s = st({
      events: [ev({ id: 'late', start: y(2000) }), ev({ id: 'none', end: y(5) }), ev({ id: 'early', start: y(1) })],
      sort: { key: 'start', dir: 'asc' },
    })
    // 'none' has no start; falls back to end (y(5)); order by instant: early(1) none(5) late(2000)
    expect(visibleEvents(s).map((e) => e.id)).toEqual(['early', 'none', 'late'])
  })
  it('sorts by title descending', () => {
    const s = st({ events: [ev({ id: 'a', title: 'alpha', start: y(1) }), ev({ id: 'b', title: 'beta', start: y(2) })], sort: { key: 'title', dir: 'desc' } })
    expect(visibleEvents(s).map((e) => e.id)).toEqual(['b', 'a'])
  })
  it('sorts by category name ascending, uncategorized last', () => {
    const s = st({
      categories: [cat({ id: 'c2', name: 'bbb' }), cat({ id: 'c1', name: 'aaa' })],
      events: [
        ev({ id: 'none', categoryId: null, start: y(1) }),
        ev({ id: 'b', categoryId: 'c2', start: y(2) }),
        ev({ id: 'a', categoryId: 'c1', start: y(3) }),
      ],
      sort: { key: 'category', dir: 'asc' },
    })
    expect(visibleEvents(s).map((e) => e.id)).toEqual(['a', 'b', 'none'])
  })

  it('sorts by updatedAt descending', () => {
    const s = st({
      events: [
        ev({ id: 'a', updatedAt: 't1', start: y(1) }),
        ev({ id: 'b', updatedAt: 't3', start: y(2) }),
        ev({ id: 'c', updatedAt: 't2', start: y(3) }),
      ],
      sort: { key: 'updated', dir: 'desc' },
    })
    expect(visibleEvents(s).map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts events with neither start nor end last in ascending', () => {
    const s = st({
      events: [ev({ id: 'nodate' }), ev({ id: 'dated', start: y(1) })],
      sort: { key: 'start', dir: 'asc' },
    })
    expect(visibleEvents(s).map((e) => e.id)).toEqual(['dated', 'nodate'])
  })
})

describe('flattenCategoryTree', () => {
  it('lists live categories depth-first with their depth', () => {
    const cats = [cat({ id: 'a' }), cat({ id: 'b', parentId: 'a' }), cat({ id: 'c', order: 1 })]
    expect(flattenCategoryTree(cats).map((e) => [e.category.id, e.depth])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 0],
    ])
  })
})

describe('untagged / deleted filters', () => {
  it('untaggedCount counts live events with no tags', () => {
    const events = [
      ev({ id: 'a', tagIds: [] }),
      ev({ id: 'b', tagIds: ['t1'] }),
      ev({ id: 'c', tagIds: [], deleted: true }),
    ]
    expect(untaggedCount(st({ events }))).toBe(1)
  })

  it('deletedCount counts tombstoned events', () => {
    const events = [ev({ id: 'a' }), ev({ id: 'b', deleted: true })]
    expect(deletedCount(st({ events }))).toBe(1)
  })

  it('filter.untagged keeps only events with no tags', () => {
    const events = [ev({ id: 'a', tagIds: [], start: y(1) }), ev({ id: 'b', tagIds: ['t1'], start: y(2) })]
    const rows = visibleEvents(st({ events, filter: { ...initialAppState(2026, 'day').filter, untagged: true } }))
    expect(rows.map((e) => e.id)).toEqual(['a'])
  })

  it('filter.trash shows only deleted events', () => {
    const events = [ev({ id: 'a', start: y(1) }), ev({ id: 'b', deleted: true, start: y(2) })]
    const rows = visibleEvents(st({ events, filter: { ...initialAppState(2026, 'day').filter, trash: true } }))
    expect(rows.map((e) => e.id)).toEqual(['b'])
  })

  it('sorts by tags then note', () => {
    const events = [
      ev({ id: 'a', title: 'a', tagIds: [], note: 'z', start: y(1) }),
      ev({ id: 'b', title: 'b', tagIds: ['t1'], note: 'a', start: y(2) }),
    ]
    const tags = [tag({ id: 't1', name: 'alpha' })]
    const byNote = visibleEvents(st({ events, tags, sort: { key: 'note', dir: 'asc' } }))
    expect(byNote.map((e) => e.id)).toEqual(['b', 'a']) // 'a' note < 'z' note
  })

  it('sorts by the tags key using live tag names', () => {
    const events = [
      ev({ id: 'a', tagIds: ['t2'], start: y(1) }),
      ev({ id: 'b', tagIds: ['t1'], start: y(2) }),
      ev({ id: 'c', tagIds: [], start: y(3) }),
    ]
    const tags = [tag({ id: 't1', name: 'alpha' }), tag({ id: 't2', name: 'zeta' })]
    const rows = visibleEvents(st({ events, tags, sort: { key: 'tags', dir: 'asc' } }))
    expect(rows.map((e) => e.id)).toEqual(['b', 'a', 'c']) // alpha < zeta < ￿(untagged)
  })

  it('excludes deleted tags from the tags sort key', () => {
    const events = [
      ev({ id: 'a', tagIds: ['t1'], start: y(1) }),
      ev({ id: 'b', tagIds: ['t2'], start: y(2) }),
    ]
    const tags = [tag({ id: 't1', name: 'zeta', deleted: true }), tag({ id: 't2', name: 'alpha' })]
    const rows = visibleEvents(st({ events, tags, sort: { key: 'tags', dir: 'asc' } }))
    expect(rows.map((e) => e.id)).toEqual(['a', 'b']) // 'a' resolves to '' (deleted tag excluded) < 'alpha'
  })
})
