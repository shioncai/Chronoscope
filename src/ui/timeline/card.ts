import type { EventRecord, Category, Tag, Id } from '../../domain/model'
import { formatTimePoint } from '../../domain/time'
import type { TimePoint } from '../../domain/time'
import type { Locale } from '../../domain/locale'

export interface EventCardData {
  id: Id
  title: string
  timeLabel: string
  note: string
  categoryName: string | null
  tagNames: string[]
  links: { id: Id; title: string }[]
}

export interface CardLookups {
  categories: Category[]
  tags: Tag[]
  events: EventRecord[]
}

export function formatEventTime(event: EventRecord, locale: Locale = 'zh'): string {
  const fmt = (tp: TimePoint) => formatTimePoint(tp, locale)
  if (event.start && event.end) return `${fmt(event.start)} – ${fmt(event.end)}`
  if (event.start) return fmt(event.start)
  if (event.end) return `→ ${fmt(event.end)}`
  return '—'
}

export function buildEventCard(event: EventRecord, lookups: CardLookups, locale: Locale = 'zh'): EventCardData {
  const cat =
    event.categoryId != null
      ? lookups.categories.find((c) => c.id === event.categoryId && !c.deleted) ?? null
      : null
  const tagNames = event.tagIds
    .map((id) => lookups.tags.find((t) => t.id === id && !t.deleted)?.name)
    .filter((n): n is string => Boolean(n))
  const links = event.links
    .map((id) => lookups.events.find((e) => e.id === id && !e.deleted))
    .filter((e): e is EventRecord => Boolean(e))
    .map((e) => ({ id: e.id, title: e.title }))
  return {
    id: event.id,
    title: event.title,
    timeLabel: formatEventTime(event, locale),
    note: event.note,
    categoryName: cat?.name ?? null,
    tagNames,
    links,
  }
}
