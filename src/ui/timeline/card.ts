import type { EventRecord, Category, Tag, Id } from '../../domain/model'
import { formatTimePoint, formatDuration, formatRelative, instantOf, type TimePoint } from '../../domain/time'
import type { Locale } from '../../domain/locale'

export interface EventCardData {
  id: Id
  title: string
  timeLabel: string
  /** How long a span lasted; null for a point. */
  duration: string | null
  /** How far its start lies from now: "1,953 years ago". */
  relative: string | null
  note: string
  categoryName: string | null
  /** The folder's full path, outermost first. */
  categoryPath: string[]
  categoryColor: string | null
  tagNames: string[]
  links: { id: Id; title: string }[]
  deleted: boolean
}

export interface CardLookups {
  categories: Category[]
  tags: Tag[]
  events: EventRecord[]
  nowYear?: number
}

export function formatEventTime(event: EventRecord, locale: Locale = 'zh'): string {
  const fmt = (tp: TimePoint) => formatTimePoint(tp, locale)
  if (event.start && event.end) return `${fmt(event.start)} – ${fmt(event.end)}`
  if (event.start) return fmt(event.start)
  if (event.end) return `→ ${fmt(event.end)}`
  return '—'
}

export function buildEventCard(event: EventRecord, lookups: CardLookups, locale: Locale = 'zh'): EventCardData {
  const byId = new Map(lookups.categories.map((c) => [c.id, c]))
  const cat = event.categoryId != null ? byId.get(event.categoryId) : undefined
  const live = cat && !cat.deleted ? cat : undefined
  const path: string[] = []
  const seen = new Set<Id>()
  for (let c = live; c && !c.deleted && !seen.has(c.id); c = c.parentId != null ? byId.get(c.parentId) : undefined) {
    seen.add(c.id)
    path.unshift(c.name)
  }
  const tagNames = event.tagIds
    .map((id) => lookups.tags.find((t) => t.id === id && !t.deleted)?.name)
    .filter((n): n is string => Boolean(n))
  const links = event.links
    .map((id) => lookups.events.find((e) => e.id === id && !e.deleted))
    .filter((e): e is EventRecord => Boolean(e))
    .map((e) => ({ id: e.id, title: e.title }))
  const first = event.start ?? event.end
  const span = event.start && event.end ? instantOf(event.end) - instantOf(event.start) : null
  return {
    id: event.id,
    title: event.title,
    timeLabel: formatEventTime(event, locale),
    duration: span !== null && span > 0 ? formatDuration(span, locale) : null,
    relative: first && lookups.nowYear !== undefined ? formatRelative(lookups.nowYear - instantOf(first), locale) : null,
    note: event.note,
    categoryName: live?.name ?? null,
    categoryPath: path,
    categoryColor: live?.color ?? null,
    tagNames,
    links,
    deleted: event.deleted,
  }
}
