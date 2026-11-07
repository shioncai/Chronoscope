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
    if (abs >= 1e8) return `约${oneDecimal(abs / 1e8)}亿年${dir}`
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

// ── Ages, durations, relative time ──────────────────────────────────────────
// Three short phrasings of a span of years, used where a TimePoint is not the
// right input: axis ticks (an age measured from a reference), an event's
// duration, and how long ago something was. They share one ladder of units so
// the same magnitude reads the same everywhere in the app.

const DAY = 1 / 365.2425
const HOUR = DAY / 24
const MINUTE = HOUR / 60

/** Trim a number for display: integers grouped, small values to one decimal. */
function amount(n: number, locale: Locale): string {
  const r = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10
  return locale === 'en' ? new Intl.NumberFormat('en-US').format(r) : String(r)
}

type AgeUnit = 'minute' | 'hour' | 'day' | 'month' | 'year' | 'ka' | 'Ma' | 'Ga' | 'wan' | 'yi'

/** Pick the unit a magnitude (in years) is spoken in, per language. */
function unitFor(abs: number, locale: Locale): { unit: AgeUnit; n: number } {
  if (abs < HOUR) return { unit: 'minute', n: abs / MINUTE }
  if (abs < DAY) return { unit: 'hour', n: abs / HOUR }
  if (abs < 1 / 12) return { unit: 'day', n: abs / DAY }
  if (abs < 1) return { unit: 'month', n: abs * 12 }
  if (locale === 'en') {
    if (abs < 1e4) return { unit: 'year', n: abs }
    if (abs < 1e6) return { unit: 'ka', n: abs / 1e3 }
    if (abs < 1e9) return { unit: 'Ma', n: abs / 1e6 }
    return { unit: 'Ga', n: abs / 1e9 }
  }
  if (abs < 1e4) return { unit: 'year', n: abs }
  if (abs < 1e8) return { unit: 'wan', n: abs / 1e4 }
  return { unit: 'yi', n: abs / 1e8 }
}

const ZH_UNIT: Record<AgeUnit, string> = {
  minute: '分钟', hour: '小时', day: '天', month: '个月', year: '年',
  ka: '千年', Ma: '百万年', Ga: '十亿年', wan: '万年', yi: '亿年',
}
const EN_SHORT: Record<AgeUnit, string> = {
  minute: 'min', hour: 'h', day: 'd', month: 'mo', year: 'yr',
  ka: 'ka', Ma: 'Ma', Ga: 'Ga', wan: '', yi: '',
}
const EN_LONG: Record<AgeUnit, [string, string]> = {
  minute: ['minute', 'minutes'], hour: ['hour', 'hours'], day: ['day', 'days'],
  month: ['month', 'months'], year: ['year', 'years'],
  ka: ['thousand years', 'thousand years'], Ma: ['million years', 'million years'],
  Ga: ['billion years', 'billion years'], wan: ['', ''], yi: ['', ''],
}

/**
 * An axis label for an age — how far a tick sits before (positive) or after
 * (negative) its reference. Terse, because ticks are packed: "66 Ma", "250 yr
 * ago", "6600万年前". Geology's ka/Ma/Ga already mean "ago", so English drops
 * the word there.
 */
export function formatAgeLabel(age: number, locale: Locale = 'zh'): string {
  const abs = Math.abs(age)
  if (abs < MINUTE) return locale === 'en' ? 'now' : '现在'
  const { unit, n } = unitFor(abs, locale)
  const num = amount(n, locale)
  if (locale === 'en') {
    const deep = unit === 'ka' || unit === 'Ma' || unit === 'Ga'
    const text = `${num} ${EN_SHORT[unit]}`
    if (age > 0) return deep ? text : `${text} ago`
    return `in ${text}`
  }
  return `${num}${ZH_UNIT[unit]}${age > 0 ? '前' : '后'}`
}

/** How long something lasted: "312 years", "2.5 days", "3.2亿年". */
export function formatDuration(years: number, locale: Locale = 'zh'): string {
  const abs = Math.abs(years)
  if (abs < MINUTE) return locale === 'en' ? 'under a minute' : '不到一分钟'
  const { unit, n } = unitFor(abs, locale)
  const num = amount(n, locale)
  if (locale === 'en') {
    const [one, many] = EN_LONG[unit]
    return `${num} ${num === '1' ? one : many}`
  }
  return `${num}${ZH_UNIT[unit]}`
}

/** How far an instant lies from now, as prose: "1,953 years ago", "3天后". */
export function formatRelative(age: number, locale: Locale = 'zh'): string {
  if (Math.abs(age) < MINUTE) return locale === 'en' ? 'now' : '现在'
  const d = formatDuration(age, locale)
  if (locale === 'en') return age > 0 ? `${d} ago` : `in ${d}`
  return `${d}${age > 0 ? '前' : '后'}`
}
