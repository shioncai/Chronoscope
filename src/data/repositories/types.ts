import type { Id, EventRecord, Category, Tag } from '../../domain/model'

/**
 * Storage abstraction; the in-memory and Dexie implementations are
 * interchangeable behind this interface.
 *
 * Caveat on optional fields: backends may differ on absent-vs-`undefined`
 * keys. IndexedDB's structured clone drops keys whose value is `undefined`,
 * so e.g. an `EventRecord` saved without `start` reads back WITHOUT the key
 * from Dexie but WITH `start: undefined` from the in-memory repo. Consumers
 * must not rely on key presence — test optional fields with `!= null`, never
 * `'start' in record`.
 */
export interface Repository<T extends { id: Id }> {
  getAll(): Promise<T[]>
  get(id: Id): Promise<T | undefined>
  put(record: T): Promise<void>
  bulkPut(records: T[]): Promise<void>
  // Hard delete (used only by the recycle bin's "永久删除" — soft delete is a
  // `deleted` flag written via `put`).
  delete(id: Id): Promise<void>
  bulkDelete(ids: Id[]): Promise<void>
}

export interface Database {
  events: Repository<EventRecord>
  categories: Repository<Category>
  tags: Repository<Tag>
}
