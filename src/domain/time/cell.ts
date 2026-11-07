import { daysInMonth } from './gregorian'
import type { AbsolutePrecision, RelativePrecision } from './precision'
import { type TimePoint, fromAgo, fromCivil, fromYear, withFuzz } from './timepoint'

/**
 * A TimePoint as one line of plain text — the time cells of a CSV file. The
 * format is meant to be both written by hand in a spreadsheet and read back
 * without loss, so `parseTimeCell(formatTimeCell(tp))` reproduces `tp`.
 *
 *   2026-03-15 14:30[:05]   calendar date down to the minute (or second)
 *   2026-03-15 14           to the hour
 *   1969-07 · 1969          month · year
 *   500 BCE · 500-03 BCE    before the common era (also "BC", "公元前500年")
 *   -0499                   ISO 8601 astronomical numbering (= 500 BCE)
 *   1990s · 1990 [decade]   coarse calendar precisions; also [century], [millennium]
 *   66 Ma · 4.6 Ga · 12 ka  before present (1950), as geology writes it; "46亿年前" too
 *   … ± 3 d · … -1/+2 y     an uncertainty range; units d, y, ka, Ma, Ga (default y)
 */

export type CellParse = { ok: true; value: TimePoint | undefined } | { ok: false }

const UNIT_YEARS = { d: 1 / 365.2425, y: 1, ka: 1e3, ma: 1e6, ga: 1e9 } as const
type FuzzUnit = keyof typeof UNIT_YEARS
const DEEP: Record<string, RelativePrecision> = { ka: 'ka', ma: 'Ma', ga: 'Ga' }

const FAIL: CellParse = { ok: false }

export function parseTimeCell(input: string): CellParse {
  let s = input.trim()
  if (s === '') return { ok: true, value: undefined }

  // ── trailing uncertainty ──
  let fuzz: { before: number; after: number } | undefined
  const sym = /\s*(?:±|\+\/-|\+-)\s*(\d+(?:\.\d+)?)\s*(d|y|ka|ma|ga)?\s*$/i.exec(s)
  const asym = /\s+-\s*(\d+(?:\.\d+)?)\s*\/\s*\+\s*(\d+(?:\.\d+)?)\s*(d|y|ka|ma|ga)?\s*$/i.exec(s)
  if (sym) {
    const u = UNIT_YEARS[(sym[2]?.toLowerCase() ?? 'y') as FuzzUnit]
    fuzz = { before: Number(sym[1]) * u, after: Number(sym[1]) * u }
    s = s.slice(0, sym.index).trim()
  } else if (asym) {
    const u = UNIT_YEARS[(asym[3]?.toLowerCase() ?? 'y') as FuzzUnit]
    fuzz = { before: Number(asym[1]) * u, after: Number(asym[2]) * u }
    s = s.slice(0, asym.index).trim()
  }
  const point = parsePoint(s)
  if (!point) return FAIL
  return { ok: true, value: fuzz ? withFuzz(point, fuzz) : point }
}

function parsePoint(raw: string): TimePoint | null {
  let s = raw.trim()

  // ── deep time ──
  const deep = /^(-?\d+(?:\.\d+)?)\s*(ka|ma|ga)(?:\s+ago|\s+bp)?$/i.exec(s)
  if (deep) {
    const unit = DEEP[deep[2].toLowerCase()]
    return fromAgo(Number(deep[1]) * UNIT_YEARS[deep[2].toLowerCase() as FuzzUnit], unit)
  }
  const zhDeep = /^约?\s*(\d+(?:\.\d+)?)\s*(亿|万)年前$/.exec(s)
  if (zhDeep) {
    const ago = Number(zhDeep[1]) * (zhDeep[2] === '亿' ? 1e8 : 1e4)
    return fromAgo(ago, ago >= 1e9 ? 'Ga' : ago >= 1e6 ? 'Ma' : 'ka')
  }

  // ── coarse precision tag ──
  let precision: AbsolutePrecision | null = null
  const tag = /\s*\[(decade|century|millennium)\]$/i.exec(s)
  if (tag) {
    precision = tag[1].toLowerCase() as AbsolutePrecision
    s = s.slice(0, tag.index).trim()
  } else if (/^\d+s$/i.test(s)) {
    precision = 'decade'
    s = s.slice(0, -1)
  }

  // ── era ──
  let bce = false
  const suffix = /\s*(?:BCE|BC|B\.C\.E?\.?)$/i.exec(s)
  if (suffix) {
    bce = true
    s = s.slice(0, suffix.index).trim()
  } else if (/^(?:公元前|前)/.test(s)) {
    bce = true
    s = s.replace(/^(?:公元前|前)/, '')
  }
  s = s.replace(/\s*(?:CE|AD|A\.D\.)$/i, '').replace(/^公元/, '')
  // Chinese calendar notation: 2026年3月15日 → 2026-3-15
  s = s.replace(/年(?=\d)/, '-').replace(/月(?=\d)/, '-').replace(/[年月日号]$/, '').trim()

  const m = /^(-?\d+)(?:[-/.](\d{1,2})(?:[-/.](\d{1,2})(?:[ T]+(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?)?)?)?$/.exec(s)
  if (!m) return null
  const written = Number(m[1])
  if (bce && written < 1) return null
  const y = bce ? 1 - written : written

  if (precision) return m[2] ? null : fromYear(y, precision)
  if (!m[2]) return fromYear(y, 'year')
  const mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  if (!m[3]) return fromCivil({ y, mo }, 'month')
  const d = Number(m[3])
  if (d < 1 || d > daysInMonth(y, mo)) return null
  if (m[4] === undefined) return fromCivil({ y, mo, d }, 'day')
  const h = Number(m[4])
  if (h > 23) return null
  if (m[5] === undefined) return fromCivil({ y, mo, d, h }, 'hour')
  const mi = Number(m[5])
  if (mi > 59) return null
  if (m[6] === undefined) return fromCivil({ y, mo, d, h, mi }, 'minute')
  const sec = Number(m[6])
  if (sec > 59) return null
  return fromCivil({ y, mo, d, h, mi, s: sec }, 'second')
}

const pad = (n: number) => String(n).padStart(2, '0')
// Up to 10 significant digits — far finer than any real input, but enough to
// shave off float noise like 4.6000000000000005.
const num = (n: number) => String(Number(n.toPrecision(10)))

export function formatTimeCell(tp: TimePoint | undefined): string {
  if (!tp) return ''
  return pointText(tp) + fuzzText(tp.fuzz)
}

function pointText(tp: TimePoint): string {
  if ('ago' in tp) {
    const unit = UNIT_YEARS[tp.precision.toLowerCase() as FuzzUnit]
    return `${num(tp.ago / unit)} ${tp.precision}`
  }
  const era = (y: number) => (y > 0 ? { n: y, suffix: '' } : { n: 1 - y, suffix: ' BCE' })
  const c = tp.civil
  switch (tp.precision) {
    case 'decade':
    case 'century':
    case 'millennium': {
      const { n, suffix } = era(Math.round(tp.year))
      return `${n}${suffix} [${tp.precision}]`
    }
    case 'month':
    case 'day':
    case 'hour':
    case 'minute':
    case 'second': {
      if (!c) break
      const { n, suffix } = era(c.y)
      let out = `${n}-${pad(c.mo)}`
      if (tp.precision !== 'month') out += `-${pad(c.d ?? 1)}`
      if (tp.precision === 'hour') out += ` ${pad(c.h ?? 0)}`
      if (tp.precision === 'minute' || tp.precision === 'second') out += ` ${pad(c.h ?? 0)}:${pad(c.mi ?? 0)}`
      if (tp.precision === 'second') out += `:${pad(c.s ?? 0)}`
      return out + suffix
    }
  }
  const { n, suffix } = era(Math.round(c?.y ?? tp.year))
  return `${n}${suffix}`
}

function fuzzText(f: TimePoint['fuzz']): string {
  if (!f || (f.before <= 0 && f.after <= 0)) return ''
  const mag = Math.max(f.before, f.after)
  const unit: FuzzUnit = mag >= 1e9 ? 'ga' : mag >= 1e6 ? 'ma' : mag >= 1e3 ? 'ka' : mag >= 1 ? 'y' : 'd'
  const label = unit === 'ga' ? 'Ga' : unit === 'ma' ? 'Ma' : unit
  const v = (x: number) => String(Number((x / UNIT_YEARS[unit]).toPrecision(6)))
  if (f.before === f.after) return ` ± ${v(f.before)} ${label}`
  return ` -${v(f.before)}/+${v(f.after)} ${label}`
}
