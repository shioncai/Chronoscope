import { PRECISION_YEARS, type Precision } from './precision'
import type { TimePoint } from './timepoint'
import type { Locale } from '../locale'

const CIVIL_REQUIRED: Precision[] = ['second', 'minute', 'hour', 'day', 'month']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function oneDecimal(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
function grouped(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}
// English ordinal: 1st, 2nd, 3rd, 4th, 11th, 21st, ...
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

// ── Chinese ────────────────────────────────────────────────────────────────
function yearNumZh(y: number): string {
  return y > 0 ? `${y}` : `公元前${1 - y}`
}
function yearLabelZh(y: number): string {
  return y > 0 ? `${y}年` : `公元前${1 - y}年`
}
function formatZh(tp: TimePoint): string {
  if ('ago' in tp) {
    const ago = tp.ago
    const abs = Math.abs(ago)
    if (abs < PRECISION_YEARS[tp.precision] / 2) return '现在'
    const dir = ago > 0 ? '前' : '后'
    if (abs >= 1e8) return `约${(abs / 1e8).toFixed(1)}亿年${dir}`
    if (abs >= 1e4) return `约${oneDecimal(abs / 1e4)}万年${dir}`
    return `约${Math.round(abs)}年${dir}`
  }
  const c = tp.civil
  if (CIVIL_REQUIRED.includes(tp.precision) && !c) return yearLabelZh(tp.year)
  switch (tp.precision) {
    case 'second':
      return `${yearNumZh(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)} ${pad(c!.h ?? 0)}:${pad(c!.mi ?? 0)}:${pad(c!.s ?? 0)}`
    case 'minute':
      return `${yearNumZh(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)} ${pad(c!.h ?? 0)}:${pad(c!.mi ?? 0)}`
    case 'hour':
      return `${yearNumZh(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)} ${pad(c!.h ?? 0)}时`
    case 'day':
      return `${yearNumZh(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)}`
    case 'month':
      return `${yearNumZh(c!.y)}-${pad(c!.mo)}`
    case 'year':
      return yearLabelZh(tp.year)
    case 'decade':
      return tp.year > 0 ? `${tp.year}年代` : `公元前${1 - tp.year}年代`
    case 'century':
      return tp.year >= 0
        ? `${Math.floor(tp.year / 100) + 1}世纪`
        : `公元前${Math.floor(-tp.year / 100) + 1}世纪`
    case 'millennium':
      return `${yearLabelZh(tp.year)}起千年`
    default:
      return yearLabelZh(tp.year)
  }
}

// ── English ──────────────────────────────────────────────────────────────────
function yearNumEn(y: number): string {
  return y > 0 ? `${y}` : `${1 - y} BCE`
}
function formatEn(tp: TimePoint): string {
  if ('ago' in tp) {
    const ago = tp.ago
    const abs = Math.abs(ago)
    if (abs < PRECISION_YEARS[tp.precision] / 2) return 'now'
    const dir = ago > 0 ? 'ago' : 'from now'
    if (abs >= 1e9) return `~${oneDecimal(abs / 1e9)} billion years ${dir}`
    if (abs >= 1e6) return `~${oneDecimal(abs / 1e6)} million years ${dir}`
    return `~${grouped(abs)} years ${dir}`
  }
  const c = tp.civil
  if (CIVIL_REQUIRED.includes(tp.precision) && !c) return yearNumEn(tp.year)
  switch (tp.precision) {
    case 'second':
      return `${yearNumEn(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)} ${pad(c!.h ?? 0)}:${pad(c!.mi ?? 0)}:${pad(c!.s ?? 0)}`
    case 'minute':
      return `${yearNumEn(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)} ${pad(c!.h ?? 0)}:${pad(c!.mi ?? 0)}`
    case 'hour':
      return `${yearNumEn(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)} ${pad(c!.h ?? 0)}:00`
    case 'day':
      return `${yearNumEn(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)}`
    case 'month':
      return `${yearNumEn(c!.y)}-${pad(c!.mo)}`
    case 'year':
      return yearNumEn(tp.year)
    case 'decade':
      return tp.year > 0 ? `${tp.year}s` : `${1 - tp.year}s BCE`
    case 'century':
      return tp.year >= 0
        ? `${ordinal(Math.floor(tp.year / 100) + 1)} century`
        : `${ordinal(Math.floor(-tp.year / 100) + 1)} century BCE`
    case 'millennium':
      return `millennium from ${yearNumEn(tp.year)}`
    default:
      return yearNumEn(tp.year)
  }
}

export function formatTimePoint(tp: TimePoint, locale: Locale = 'zh'): string {
  return locale === 'en' ? formatEn(tp) : formatZh(tp)
}

/**
 * The same moment, in the least room that still tells the truth — for a column
 * too narrow for a phrase. The sidebar tree is one: an event row there is about
 * 160px once the folder indent is paid for, and "~445 million years ago" claims
 * nearly all of it, which is what used to squeeze the event's own title out of
 * its row.
 *
 * Only deep time is rewritten, into the unit the editor already accepts as
 * input: ~445 Ma, ~4.6 Ga. That is shorter than the prose in either language,
 * and — unlike the prose, where English runs three times the length of Chinese —
 * it is the same width in both. Everything else is already short and is left
 * reading exactly as it does elsewhere in the app.
 */
export function formatTimePointShort(tp: TimePoint, locale: Locale = 'zh'): string {
  if (!('ago' in tp)) return formatTimePoint(tp, locale)

  const abs = Math.abs(tp.ago)
  // Below a millennium there is no unit to collapse into, and "~800 yr" would
  // read as the year 800. The prose is short enough there anyway.
  if (abs < 1e3) return formatTimePoint(tp, locale)

  const [n, unit] =
    abs >= 1e9
      ? [oneDecimal(abs / 1e9), 'Ga']
      : abs >= 1e6
        ? [oneDecimal(abs / 1e6), 'Ma']
        : [oneDecimal(abs / 1e3), 'ka']
  const magnitude = `~${n} ${unit}`

  if (tp.ago > 0) return magnitude // the past: the overwhelmingly common case
  return locale === 'en' ? `in ${magnitude}` : `${magnitude}后`
}
