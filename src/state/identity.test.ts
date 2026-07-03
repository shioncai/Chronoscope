import { describe, it, expect } from 'vitest'
import { liveEventAt, liveFolderAt, eventDiffFields, moveConflicts } from './identity'
import type { EventRecord, Category } from '../domain/model'
import { fromYear } from '../domain/time'

const ev = (id: string, extra: Partial<EventRecord> = {}): EventRecord =>
  ({ id, title: id, note: '', categoryId: null, tagIds: [], links: [], createdAt: 't0',
     updatedAt: 't0', deleted: false, start: fromYear(2000, 'year'), ...extra })
const cat = (id: string, name: string, parentId: string | null = null, extra: Partial<Category> = {}): Category =>
  ({ id, name, parentId, color: '#111', order: 0, updatedAt: 't0', deleted: false, ...extra })

describe('liveFolderAt', () => {
  it('finds a live sibling folder by name+parent, ignoring deleted and self', () => {
    const cats = [
      cat('a', '历史', null),
      cat('b', '历史', 'p'),            // different parent
      cat('c', '历史', null, { deleted: true }),
    ]
    expect(liveFolderAt(cats, '历史', null)?.id).toBe('a')
    expect(liveFolderAt(cats, ' 历史 ', null)?.id).toBe('a') // trimmed
    expect(liveFolderAt(cats, '历史', null, 'a')).toBeUndefined() // exclude self
    expect(liveFolderAt(cats, '历史', 'other')).toBeUndefined()
  })
})

describe('liveEventAt', () => {
  it('finds a live event by title+folder, ignoring deleted and self', () => {
    const events = [
      ev('a', { title: '登月', categoryId: 'f1' }),
      ev('b', { title: '登月', categoryId: 'f2' }),         // other folder
      ev('c', { title: '登月', categoryId: 'f1', deleted: true }), // deleted
    ]
    expect(liveEventAt(events, '登月', 'f1')?.id).toBe('a')
    expect(liveEventAt(events, ' 登月 ', 'f1')?.id).toBe('a') // trimmed
    expect(liveEventAt(events, '登月', 'f1', 'a')).toBeUndefined() // exclude self
    expect(liveEventAt(events, '登月', null)).toBeUndefined()
  })
})

describe('eventDiffFields', () => {
  it('lists only the differing display fields', () => {
    const a = ev('a', { title: 'T', start: fromYear(1969, 'year'), note: 'x', tagIds: ['t1'], links: [] })
    const b = ev('b', { title: 'T', start: fromYear(1970, 'year'), note: 'x', tagIds: ['t1', 't2'], links: ['e9'] })
    expect(eventDiffFields(a, b).sort()).toEqual(['links', 'tags', 'time'])
  })
  it('returns empty when attributes match', () => {
    const a = ev('a', { title: 'T', start: fromYear(1969, 'year'), tagIds: ['t1', 't2'] })
    const b = ev('b', { title: 'T', start: fromYear(1969, 'year'), tagIds: ['t2', 't1'] }) // set-equal
    expect(eventDiffFields(a, b)).toEqual([])
  })
  it('detects tag/link changes even when arrays are the same length (true set equality)', () => {
    const a = ev('a', { title: 'T', tagIds: ['t1', 't2'], links: ['e1', 'e2'] })
    const b = ev('b', { title: 'T', tagIds: ['t1', 't1'], links: ['e1', 'e1'] })
    expect(eventDiffFields(a, b).sort()).toEqual(['links', 'tags'])
  })
})

describe('moveConflicts', () => {
  it('reports events whose title collides with a live event in the target folder', () => {
    const events = [
      ev('x', { title: '登月', categoryId: 'f1' }),   // existing in target
      ev('m', { title: '登月', categoryId: null }),    // moving into f1 → conflict
      ev('n', { title: '阿波罗', categoryId: null }),  // moving into f1 → no conflict
    ]
    const c = moveConflicts(events, ['m', 'n'], 'f1')
    expect(c).toEqual([{ movingId: 'm', existingId: 'x' }])
  })
  it('ignores a no-op move (already in target)', () => {
    const events = [ev('m', { title: 'T', categoryId: 'f1' })]
    expect(moveConflicts(events, ['m'], 'f1')).toEqual([])
  })
})
