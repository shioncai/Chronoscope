import { PRECISION_ORDER, PRECISION_YEARS, isRelativePrecision, type Precision, type AbsolutePrecision } from './precision'
import type { LinearView } from './project'
import { type TimePoint, fromYear, fromCivil, fromAgo, PRESENT_EPOCH } from './timepoint'
import { type CivilTime, decimalFromCivil, civilFromDecimal } from './decimal'
import { daysInMonth } from './gregorian'

export function chooseTickPrecision(rangeYears: number, maxTicks = 10): Precision {
  for (const p of PRECISION_ORDER) {
    if (rangeYears / PRECISION_YEARS[p] <= maxTicks) return p
  }
  return 'Ga'
}

// Precisions finer than a year are stepped along real calendar boundaries (not
// uniform decimal-year steps), and carry a civil date, so labels read
// 2026-03 / 2026-03-15 / 2026-03-15 14:00 instead of a fractional year.
const CALENDAR: Precision[] = ['month', 'day', 'hour', 'minute', 'second']

function truncate(c: Required<CivilTime>, p: Precision): CivilTime {
  switch (p) {
    case 'month':
      return { y: c.y, mo: c.mo }
    case 'day':
      return { y: c.y, mo: c.mo, d: c.d }
    case 'hour':
      return { y: c.y, mo: c.mo, d: c.d, h: c.h }
    case 'minute':
      return { y: c.y, mo: c.mo, d: c.d, h: c.h, mi: c.mi }
    default:
      return { y: c.y, mo: c.mo, d: c.d, h: c.h, mi: c.mi, s: c.s }
  }
}

// Advance one calendar tick at the given precision, carrying across boundaries.
// Each call bumps a single field by one, so a single carry per field suffices.
function nextCalendarTick(c: CivilTime, p: Precision): CivilTime {
  let y = c.y
  let mo = c.mo
  let d = c.d ?? 1
  let h = c.h ?? 0
  let mi = c.mi ?? 0
  let s = c.s ?? 0
  if (p === 'second') s++
  else if (p === 'minute') mi++
  else if (p === 'hour') h++
  else if (p === 'day') d++
  else mo++
  if (s >= 60) { mi++; s = 0 }
  if (mi >= 60) { h++; mi = 0 }
  if (h >= 24) { d++; h = 0 }
  if (d > daysInMonth(y, mo)) { d = 1; mo++ }
  if (mo > 12) { mo = 1; y++ }
  return truncate({ y, mo, d, h, mi, s }, p)
}

export function generateTicks(view: LinearView, maxTicks = 10): TimePoint[] {
  const range = view.max - view.min
  const precision = chooseTickPrecision(range, maxTicks)
  const ticks: TimePoint[] = []

  // Year and coarser: uniform integer-multiple steps land on clean years.
  if (!CALENDAR.includes(precision)) {
    const unit = PRECISION_YEARS[precision]
    const start = Math.ceil(view.min / unit) * unit
    for (let y = start; y <= view.max; y += unit) {
      const yr = Math.round(y / unit) * unit
      ticks.push(
        isRelativePrecision(precision) ? fromAgo(PRESENT_EPOCH - yr, precision) : fromYear(yr, precision),
      )
    }
    return ticks
  }

  // Sub-year: walk real calendar boundaries from the first one at/after view.min.
  let cur = truncate(civilFromDecimal(view.min), precision)
  if (decimalFromCivil(cur) < view.min) cur = nextCalendarTick(cur, precision)
  for (let guard = 0; decimalFromCivil(cur) <= view.max && guard < maxTicks * 4 + 8; guard++) {
    // this branch only runs for CALENDAR precisions, all of which are absolute
    ticks.push(fromCivil(cur, precision as AbsolutePrecision))
    cur = nextCalendarTick(cur, precision)
  }
  return ticks
}
