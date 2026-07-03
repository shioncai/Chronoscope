import type { EventRecord, Category, Tag } from '../domain/model'

export interface TransferFile {
  app: 'chronoscope'
  version: 1
  exportedAt: string
  data: { events: EventRecord[]; categories: Category[]; tags: Tag[] }
}

export function buildTransferFile(
  state: { events: EventRecord[]; categories: Category[]; tags: Tag[] },
  exportedAt: string,
): TransferFile {
  return {
    app: 'chronoscope',
    version: 1,
    exportedAt,
    data: {
      events: state.events.filter((e) => !e.deleted),
      categories: state.categories.filter((c) => !c.deleted),
      tags: state.tags.filter((t) => !t.deleted),
    },
  }
}
