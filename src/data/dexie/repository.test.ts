import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { openDatabase, getOrCreateNodeId } from './repository'
import type { EventRecord } from '../../domain/model'

const ev = (id: string, t: string): EventRecord => ({
  id, title: id, note: '', categoryId: null, tagIds: [], links: [],
  createdAt: t, updatedAt: t, deleted: false,
})

let n = 0
const freshName = () => `chrono-test-${Date.now()}-${n++}`

describe('dexie repository', () => {
  it('round-trips records through IndexedDB', async () => {
    const { db, events } = openDatabase(freshName())
    await events.put(ev('a', 't1'))
    await events.bulkPut([ev('b', 't1'), ev('c', 't1')])
    expect(await events.get('a')).toMatchObject({ id: 'a', title: 'a' })
    expect((await events.getAll()).map((e) => e.id).sort()).toEqual(['a', 'b', 'c'])
    await events.bulkDelete(['a', 'c'])
    expect((await events.getAll()).map((e) => e.id)).toEqual(['b'])
    db.close()
  })
  it('getOrCreateNodeId is stable across calls', async () => {
    const { db } = openDatabase(freshName())
    const first = await getOrCreateNodeId(db)
    const second = await getOrCreateNodeId(db)
    expect(first).toBe(second)
    expect(first.length).toBeGreaterThan(0)
    db.close()
  })
})
