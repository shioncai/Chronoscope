import type { Id } from '../../domain/model'
import type { Repository } from './types'

export function createMemoryRepository<T extends { id: Id }>(seed: T[] = []): Repository<T> {
  const store = new Map<Id, T>(seed.map((r) => [r.id, r]))
  return {
    async getAll() {
      return [...store.values()]
    },
    async get(id) {
      return store.get(id)
    },
    async put(record) {
      store.set(record.id, record)
    },
    async bulkPut(records) {
      for (const r of records) store.set(r.id, r)
    },
    async delete(id) {
      store.delete(id)
    },
    async bulkDelete(ids) {
      for (const id of ids) store.delete(id)
    },
  }
}
