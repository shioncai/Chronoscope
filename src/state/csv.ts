import type { EventRecord, Category, Tag, Id } from '../domain/model'
import { formatTimeCell, parseTimeCell, instantOf, type TimePoint } from '../domain/time'

/**
 * Events as a spreadsheet. One row per event, folders as a path ("Earth /
 * Life") and tags as a semicolon list, times in the cell grammar of
 * domain/time/cell.ts. Importing a CSV goes through the same merge as a JSON
 * import (planImport), so it creates folders and tags by name and never
 * duplicates an event that already lives at the same title + folder.
 *
 * The export carries what a person edits, not what a sync needs: no ids, no
 * timestamps, no links. The JSON backup remains the lossless format.
 */

interface StoreData {
  events: EventRecord[]
  categories: Category[]
  tags: Tag[]
}

export const CSV_COLUMNS = ['title', 'start', 'end', 'folder', 'tags', 'note'] as const
type Column = (typeof CSV_COLUMNS)[number]

// Header names a person might plausibly type, in either language.
const HEADER_ALIASES: Record<Column, string[]> = {
  title: ['title', 'name', 'event', 'headline', '标题', '名称', '事件'],
  start: ['start', 'start date', 'date', 'from', 'begin', 'when', 'time', '起点', '开始', '开始时间', '时间', '日期'],
  end: ['end', 'end date', 'to', 'until', 'finish', '终点', '结束', '结束时间'],
  folder: ['folder', 'category', 'group', 'layer', 'path', '文件夹', '分类', '类别', '分组'],
  tags: ['tags', 'tag', 'labels', 'keywords', '标签', '关键词'],
  note: ['note', 'notes', 'description', 'desc', 'details', 'text', '备注', '描述', '说明', '内容'],
}

const FOLDER_SPLIT = /\s*\/\s*/
const TAG_SPLIT = /\s*[;；]\s*/

// ── writing ─────────────────────────────────────────────────────────────────

function cell(v: string): string {
  return /[",\r\n]|^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function folderPath(id: Id | null, byId: Map<Id, Category>): string {
  const parts: string[] = []
  const seen = new Set<Id>()
  let cur = id != null ? byId.get(id) : undefined
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    parts.unshift(cur.name)
    cur = cur.parentId != null ? byId.get(cur.parentId) : undefined
  }
  return parts.join(' / ')
}

const anchor = (e: EventRecord): number =>
  e.start ? instantOf(e.start) : e.end ? instantOf(e.end) : Number.POSITIVE_INFINITY

/** Live events, earliest first, with a UTF-8 BOM so Excel reads CJK text right. */
export function buildCsv(data: StoreData): string {
  const cats = new Map(data.categories.filter((c) => !c.deleted).map((c) => [c.id, c]))
  const tags = new Map(data.tags.filter((t) => !t.deleted).map((t) => [t.id, t.name]))
  const rows = data.events
    .filter((e) => !e.deleted)
    .sort((a, b) => anchor(a) - anchor(b))
    .map((e) =>
      [
        e.title,
        formatTimeCell(e.start),
        formatTimeCell(e.end),
        folderPath(e.categoryId, cats),
        e.tagIds.map((id) => tags.get(id)).filter(Boolean).join('; '),
        e.note,
      ].map(cell).join(','),
    )
  return '﻿' + [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n'
}

// ── reading ─────────────────────────────────────────────────────────────────

/** RFC 4180: quoted fields, doubled quotes, embedded newlines, CRLF or LF. */
export function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"' && field === '') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

export type CsvParse =
  | { ok: true; data: StoreData; invalid: number }
  | { ok: false; error: 'csv-header' }

export function parseCsv(text: string, now = ''): CsvParse {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return { ok: false, error: 'csv-header' }
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = {} as Record<Column, number>
  for (const c of CSV_COLUMNS) col[c] = header.findIndex((h) => HEADER_ALIASES[c].includes(h))
  if (col.title < 0) return { ok: false, error: 'csv-header' }

  const categories: Category[] = []
  const tags: Tag[] = []
  const events: EventRecord[] = []
  const folderIds = new Map<string, Id>() // full path → id
  const tagIds = new Map<string, Id>()
  let invalid = 0

  const folderFor = (path: string): Id | null => {
    const parts = path.split(FOLDER_SPLIT).map((p) => p.trim()).filter(Boolean)
    let parentId: Id | null = null
    let key = ''
    for (const name of parts) {
      key = key ? `${key}\u0000${name}` : name
      let id = folderIds.get(key)
      if (id === undefined) {
        id = `csv-c-${folderIds.size + 1}`
        folderIds.set(key, id)
        categories.push({ id, name, parentId, color: '#888888', order: categories.length, updatedAt: now, deleted: false })
      }
      parentId = id
    }
    return parentId
  }
  const tagFor = (name: string): Id => {
    let id = tagIds.get(name)
    if (id === undefined) {
      id = `csv-t-${tagIds.size + 1}`
      tagIds.set(name, id)
      tags.push({ id, name, color: '#888888', updatedAt: now, deleted: false })
    }
    return id
  }
  const get = (r: string[], c: Column) => (col[c] >= 0 ? (r[col[c]] ?? '').trim() : '')
  const time = (text: string): { ok: boolean; value?: TimePoint } => {
    const p = parseTimeCell(text)
    return p.ok ? { ok: true, value: p.value } : { ok: false }
  }

  for (const r of rows.slice(1)) {
    const title = get(r, 'title')
    const start = time(get(r, 'start'))
    const end = time(get(r, 'end'))
    if (!title || !start.ok || !end.ok) {
      invalid++
      continue
    }
    const folder = get(r, 'folder')
    const tagText = get(r, 'tags')
    events.push({
      id: `csv-e-${events.length + 1}`,
      title,
      start: start.value,
      end: end.value,
      note: col.note >= 0 ? (r[col.note] ?? '') : '',
      categoryId: folder ? folderFor(folder) : null,
      tagIds: tagText ? [...new Set(tagText.split(TAG_SPLIT).filter(Boolean).map(tagFor))] : [],
      links: [],
      createdAt: '',
      updatedAt: now,
      deleted: false,
    })
  }
  return { ok: true, data: { events, categories, tags }, invalid }
}
