import { type Table } from 'dexie'
import type { Repository } from '../repositories/types'
import type { EventRecord, Category, Tag } from '../../domain/model'
import { ChronoscopeDB, createChronoscopeDB } from './db'

export function createDexieRepository<T extends { id: string }>(table: Table<T, string>): Repository<T> {
  return {
    async getAll() {
      return table.toArray()
    },
    async get(id) {
      return table.get(id)
    },
    async put(record) {
      await table.put(record)
    },
    async bulkPut(records) {
      await table.bulkPut(records)
    },
    async delete(id) {
      await table.delete(id)
    },
    async bulkDelete(ids) {
      await table.bulkDelete(ids)
    },
  }
}

export function openDatabase(name?: string): {
  db: ChronoscopeDB
  events: Repository<EventRecord>
  categories: Repository<Category>
  tags: Repository<Tag>
} {
  const db = createChronoscopeDB(name)
  return {
    db,
    events: createDexieRepository(db.events),
    categories: createDexieRepository(db.categories),
    tags: createDexieRepository(db.tags),
  }
}

export async function getOrCreateNodeId(db: ChronoscopeDB): Promise<string> {
  const existing = await db.meta.get('nodeId')
  if (existing) return existing.value
  const value = crypto.randomUUID()
  await db.meta.put({ key: 'nodeId', value })
  return value
}
