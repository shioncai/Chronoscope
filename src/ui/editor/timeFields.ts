import { fromYear, fromCivil, fromAgo, type TimePoint, type Precision } from '../../domain/time'

// The structured time-entry form state. One `TimeFields` drives one TimeInput
// (start or end). It is a plain value object so the build/reverse logic stays
// pure and domain-only — the React component is a thin controlled wrapper.

export type TimeMode = 'civil' | 'scale'
export type Era = 'CE' | 'BCE'
// Coarser-than-year units. Calendar units (decade/century/millennium) take an
// era + year; relative units (ka/Ma/Ga) take a "距今" magnitude.
export type ScaleUnit = 'decade' | 'century' | 'millennium' | 'ka' | 'Ma' | 'Ga'

export interface TimeFields {
  mode: TimeMode
  era: Era
  /** civil calendar year, or the calendar year for decade/century/millennium */
  year: string
  mo: string
  d: string
  h: string
  mi: string
  /** scale mode unit */
  unit: ScaleUnit
  /** "距今" magnitude for ka/Ma/Ga */
  mag: string
}

export const SCALE_UNITS: ScaleUnit[] = ['decade', 'century', 'millennium', 'ka', 'Ma', 'Ga']
export const UNIT_YEARS: Record<'ka' | 'Ma' | 'Ga', number> = { ka: 1e3, Ma: 1e6, Ga: 1e9 }

export function isRelativeUnit(u: ScaleUnit): u is 'ka' | 'Ma' | 'Ga' {
  return u === 'ka' || u === 'Ma' || u === 'Ga'
}

export function emptyFields(): TimeFields {
  return { mode: 'civil', era: 'CE', year: '', mo: '', d: '', h: '', mi: '', unit: 'century', mag: '' }
}

function intOrNull(s: string): number | null {
  if (s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// A calendar year as written: a whole number from 1 up. "0 CE" and "-5 BCE" are
// not years anyone means; the era picker carries the sign.
function yearOrNull(s: string): number | null {
  const n = intOrNull(s)
  return n !== null && Number.isInteger(n) && n >= 1 ? n : null
}

// 公元前 V 年 ↔ astronomical year (1 - V); 公元 V 年 ↔ V.
function signedYear(era: Era, value: number): number {
  return era === 'BCE' ? 1 - value : value
}
function unsignedYear(year: number): { era: Era; value: number } {
  return year > 0 ? { era: 'CE', value: year } : { era: 'BCE', value: 1 - year }
}

/** Build a TimePoint from the form, inferring precision from the deepest filled
 *  civil field. Returns null when there isn't enough to place a point. */
export function buildTimePoint(f: TimeFields): TimePoint | null {
  if (f.mode === 'scale') {
    if (isRelativeUnit(f.unit)) {
      const mag = intOrNull(f.mag)
      if (mag === null || mag < 0) return null
      return fromAgo(mag * UNIT_YEARS[f.unit], f.unit)
    }
    const yv = yearOrNull(f.year)
    if (yv === null) return null
    return fromYear(signedYear(f.era, yv), f.unit)
  }

  // civil mode: walk year → month → day → hour → minute, stopping at the first
  // blank level (an orphaned finer field is ignored).
  const yv = yearOrNull(f.year)
  if (yv === null) return null
  const y = signedYear(f.era, yv)

  const mo = intOrNull(f.mo)
  if (mo === null) return fromYear(y, 'year')
  const d = intOrNull(f.d)
  if (d === null) return fromCivil({ y, mo }, 'month')
  const h = intOrNull(f.h)
  if (h === null) return fromCivil({ y, mo, d }, 'day')
  const mi = intOrNull(f.mi)
  if (mi === null) return fromCivil({ y, mo, d, h }, 'hour')
  return fromCivil({ y, mo, d, h, mi }, 'minute')
}

const CIVIL_PRECISIONS: Precision[] = ['second', 'minute', 'hour', 'day', 'month', 'year']

/** Reverse of buildTimePoint: seed the form from an existing TimePoint (for
 *  editing). Second precision degrades to minute (the form's finest level). */
export function fieldsFromTimePoint(tp: TimePoint | null): TimeFields {
  const f = emptyFields()
  if (!tp) return f

  if ('ago' in tp) {
    // ago is the user's exact input, so mag reads back cleanly with no
    // re-derivation and no fp noise to round away.
    const unit = tp.precision
    f.mode = 'scale'
    f.unit = unit
    f.mag = String(tp.ago / UNIT_YEARS[unit])
    return f
  }

  if (tp.precision === 'decade' || tp.precision === 'century' || tp.precision === 'millennium') {
    const { era, value } = unsignedYear(tp.year)
    f.mode = 'scale'
    f.unit = tp.precision
    f.era = era
    f.year = String(value)
    return f
  }

  if (CIVIL_PRECISIONS.includes(tp.precision)) {
    f.mode = 'civil'
    const yAstro = tp.civil?.y ?? tp.year
    const { era, value } = unsignedYear(yAstro)
    f.era = era
    f.year = String(value)
    const c = tp.civil
    const p = tp.precision
    if (c && p !== 'year') {
      f.mo = String(c.mo)
      if (p === 'day' || p === 'hour' || p === 'minute' || p === 'second') f.d = String(c.d ?? '')
      if (p === 'hour' || p === 'minute' || p === 'second') f.h = String(c.h ?? 0)
      if (p === 'minute' || p === 'second') f.mi = String(c.mi ?? 0)
    }
    return f
  }

  return f
}

/** The form filled in with the current local time, to the minute. */
export function nowFields(d = new Date()): TimeFields {
  return {
    ...emptyFields(),
    year: String(d.getFullYear()),
    mo: String(d.getMonth() + 1),
    d: String(d.getDate()),
    h: String(d.getHours()),
    mi: String(d.getMinutes()),
  }
}
