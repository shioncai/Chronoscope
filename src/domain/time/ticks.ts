import type { LinearView } from './project'
import type { Locale } from '../locale'
import { type CivilTime, decimalFromCivil, civilFromDecimal } from './decimal'
import { daysInMonth } from './gregorian'
import { fromCivil, fromYear, PRESENT_EPOCH } from './timepoint'
import { formatTimePoint, formatAgeLabel } from './format'

/** One labelled position on a time axis, in decimal years. */
export interface Tick {
  year: number
  label: string
}

type CalendarUnit = 'second' | 'minute' | 'hour' | 'day' | 'month'

interface CalendarStep {
  unit: CalendarUnit
  n: number
  years: number
}

const SECOND = 1 / 31_556_952

// Sub-year steps, finest first. Each is a whole number of a calendar field, so
// ticks land on real boundaries (14:00, the 1st, March) rather than on
// fractional years.
const CALENDAR_STEPS: CalendarStep[] = [
  ...[1, 2, 5, 10, 15, 30].map((n) => ({ unit: 'second' as const, n, years: n * SECOND })),
  ...[1, 2, 5, 10, 15, 30].map((n) => ({ unit: 'minute' as const, n, years: n * 60 * SECOND })),
  ...[1, 2, 3, 6, 12].map((n) => ({ unit: 'hour' as const, n, years: n * 3600 * SECOND })),
  ...[1, 2, 5, 10].map((n) => ({ unit: 'day' as const, n, years: n / 365.2425 })),
  ...[1, 2, 3, 6].map((n) => ({ unit: 'month' as const, n, years: n / 12 })),
]

/** The smallest 1-2-5 × 10^k number (k ≥ 0) that is at least `x`. */
export function niceStep(x: number): number {
  if (!(x > 1)) return 1
  const exp = Math.floor(Math.log10(x))
  const base = 10 ** exp
  for (const m of [1, 2, 5, 10]) if (m * base >= x) return m * base
  return 10 * base
}

// Steps at or above this many years are placed on round AGES (66 Ma, 10 ka)
// rather than round calendar years: nobody reads "-65,998,050" off an axis.
const DEEP_STEP = 1e4

/**
 * Labelled ticks for a linear view, spaced so roughly `maxTicks` fit.
 *
 * Three regimes, chosen by step size:
 * - under a year: calendar fields (months, days, hours, minutes, seconds);
 * - a year up to 10 ka: round calendar years, with BCE ticks on round BCE
 *   numbers (1000 BCE, not the "1001 BCE" a multiple of 1000 would give);
 * - 10 ka and up: round ages before present.
 */
export function generateTicks(view: LinearView, maxTicks = 10, locale: Locale = 'zh'): Tick[] {
  const range = view.max - view.min
  if (!(range > 0) || !Number.isFinite(range)) return []
  const target = range / Math.max(1, maxTicks)

  if (target < 1) {
    const step = CALENDAR_STEPS.find((s) => s.years >= target)
    if (step) return calendarTicks(view, step, maxTicks, locale)
  }

  const step = niceStep(target)
  if (step >= DEEP_STEP) return ageTicks(view, step, locale)
  return yearTicks(view, step, locale)
}

function yearTicks(view: LinearView, step: number, locale: Locale): Tick[] {
  const out: Tick[] = []
  // BCE side: astronomical year 1 - k·step reads as "k·step BCE".
  const kFar = Math.floor((1 - view.min) / step)
  const kNear = Math.max(1, Math.ceil((1 - view.max) / step))
  for (let k = kFar; k >= kNear; k--) out.push(yearTick(1 - k * step, locale))
  // CE side: plain multiples of the step.
  const lo = Math.max(1, Math.ceil(view.min / step))
  const hi = Math.floor(view.max / step)
  for (let k = lo; k <= hi; k++) out.push(yearTick(k * step, locale))
  return out
}

function yearTick(year: number, locale: Locale): Tick {
  return { year, label: formatTimePoint(fromYear(year, 'year'), locale) }
}

function ageTicks(view: LinearView, step: number, locale: Locale): Tick[] {
  const out: Tick[] = []
  const ageFar = PRESENT_EPOCH - view.min
  const ageNear = PRESENT_EPOCH - view.max
  for (let k = Math.floor(ageFar / step); k >= Math.ceil(ageNear / step); k--) {
    const age = k * step
    out.push({ year: PRESENT_EPOCH - age, label: formatAgeLabel(age, locale) })
  }
  return out
}

function calendarTicks(view: LinearView, step: CalendarStep, maxTicks: number, locale: Locale): Tick[] {
  const out: Tick[] = []
  let cur = alignDown(civilFromDecimal(view.min), step)
  // a generous guard: aligned starts and month restarts can add a few extra
  for (let guard = 0; guard < maxTicks * 4 + 16; guard++) {
    const year = decimalFromCivil(cur)
    if (year > view.max) break
    if (year >= view.min) out.push({ year, label: formatTimePoint(fromCivil(cur, step.unit), locale) })
    cur = advance(cur, step)
  }
  return out
}

function alignDown(c: Required<CivilTime>, { unit, n }: CalendarStep): CivilTime {
  const down = (v: number, base = 0) => base + Math.floor((v - base) / n) * n
  switch (unit) {
    case 'month':
      return { y: c.y, mo: down(c.mo, 1) }
    case 'day':
      return { y: c.y, mo: c.mo, d: down(c.d, 1) }
    case 'hour':
      return { y: c.y, mo: c.mo, d: c.d, h: down(c.h) }
    case 'minute':
      return { y: c.y, mo: c.mo, d: c.d, h: c.h, mi: down(c.mi) }
    default:
      return { y: c.y, mo: c.mo, d: c.d, h: c.h, mi: c.mi, s: down(c.s) }
  }
}

// One step forward, carrying into coarser fields. Day steps restart at the 1st
// of every month (1, 11, 21, then the next 1st), and drop a final tick that
// would sit closer than half a step to the month's end.
function advance(c: CivilTime, { unit, n }: CalendarStep): CivilTime {
  let { y, mo } = c
  let d = c.d ?? 1
  let h = c.h ?? 0
  let mi = c.mi ?? 0
  let s = c.s ?? 0
  if (unit === 'month') {
    mo += n
    while (mo > 12) { mo -= 12; y++ }
    return { y, mo }
  }
  if (unit === 'day') {
    d += n
    if (d > daysInMonth(y, mo) - Math.floor(n / 2)) {
      d = 1
      mo++
      if (mo > 12) { mo = 1; y++ }
    }
    return { y, mo, d }
  }
  if (unit === 'hour') h += n
  else if (unit === 'minute') mi += n
  else s += n
  if (s >= 60) { mi += Math.floor(s / 60); s %= 60 }
  if (mi >= 60) { h += Math.floor(mi / 60); mi %= 60 }
  if (h >= 24) { d += Math.floor(h / 24); h %= 24 }
  if (d > daysInMonth(y, mo)) { d = 1; mo++ }
  if (mo > 12) { mo = 1; y++ }
  if (unit === 'hour') return { y, mo, d, h }
  if (unit === 'minute') return { y, mo, d, h, mi }
  return { y, mo, d, h, mi, s }
}
