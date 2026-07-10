import type { EventRecord, Category, Tag } from '../domain/model'

export interface TransferFile {
  app: 'chronoscope'
  version: 2
  exportedAt: string
  data: { events: EventRecord[]; categories: Category[]; tags: Tag[] }
}

export function buildTransferFile(
  state: { events: EventRecord[]; categories: Category[]; tags: Tag[] },
  exportedAt: string,
): TransferFile {
  return {
    app: 'chronoscope',
    version: 2,
    exportedAt,
    data: {
      events: state.events.filter((e) => !e.deleted),
      categories: state.categories.filter((c) => !c.deleted),
      tags: state.tags.filter((t) => !t.deleted),
    },
  }
}

export type TransferError = 'corrupt-json' | 'not-chronoscope' | 'unsupported-version' | 'incomplete'

export type ParseResult =
  | { ok: true; file: TransferFile }
  | { ok: false; error: TransferError; version?: string }

export function parseTransferFile(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'corrupt-json' }
  }
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'corrupt-json' }
  }
  const obj = raw as Record<string, unknown>
  if (obj.app !== 'chronoscope') {
    return { ok: false, error: 'not-chronoscope' }
  }
  // accept v1 (legacy absolute deep-time; migrated on import) and v2 (ago offsets)
  if (obj.version !== 1 && obj.version !== 2) {
    return { ok: false, error: 'unsupported-version', version: String(obj.version) }
  }
  const data = obj.data as Record<string, unknown> | undefined
  if (!data || !Array.isArray(data.events) || !Array.isArray(data.categories) || !Array.isArray(data.tags)) {
    return { ok: false, error: 'incomplete' }
  }
  return {
    ok: true,
    file: {
      app: 'chronoscope',
      version: 2,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
      data: {
        events: data.events as TransferFile['data']['events'],
        categories: data.categories as TransferFile['data']['categories'],
        tags: data.tags as TransferFile['data']['tags'],
      },
    },
  }
}
