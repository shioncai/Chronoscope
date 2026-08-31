import { describe, it, expect } from 'vitest'
import { createMemoryRepository } from './memory'

interface Row { id: string; v: number }

describe('memory repository', () => {
  it('put then get/getAll round-trips and upserts', async () => {
    const repo = createMemoryRepository<Row>()
    await repo.put({ id: 'a', v: 1 })
    await repo.put({ id: 'a', v: 2 }) // upsert
    await repo.put({ id: 'b', v: 9 })
    expect(await repo.get('a')).toEqual({ id: 'a', v: 2 })
    expect((await repo.getAll()).sort((x, y) => x.id.localeCompare(y.id))).toEqual([
      { id: 'a', v: 2 }, { id: 'b', v: 9 },
    ])
  })
  it('get returns undefined for a missing id', async () => {
    const repo = createMemoryRepository<Row>()
    expect(await repo.get('nope')).toBeUndefined()
  })
  it('bulkPut inserts many', async () => {
    const repo = createMemoryRepository<Row>([{ id: 'a', v: 1 }])
    await repo.bulkPut([{ id: 'b', v: 2 }, { id: 'c', v: 3 }])
    expect((await repo.getAll()).length).toBe(3)
  })
  it('bulkPut upserts existing records', async () => {
    const repo = createMemoryRepository<Row>([{ id: 'a', v: 1 }])
    await repo.bulkPut([{ id: 'a', v: 99 }, { id: 'b', v: 2 }])
    expect(await repo.get('a')).toEqual({ id: 'a', v: 99 })
    expect((await repo.getAll()).length).toBe(2)
  })
  it('bulkDelete removes many and ignores unknown ids', async () => {
    const repo = createMemoryRepository<Row>([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 3 }])
    await repo.bulkDelete(['a', 'c', 'nope'])
    expect((await repo.getAll()).map((r) => r.id)).toEqual(['b'])
  })
})
