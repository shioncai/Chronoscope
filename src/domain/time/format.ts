import { PRECISION_YEARS, type Precision } from './precision'
import type { TimePoint } from './timepoint'

const CIVIL_REQUIRED: Precision[] = ['second', 'minute', 'hour', 'day', 'month']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function yearNum(y: number): string {
  return y > 0 ? `${y}` : `公元前${1 - y}`
}
function yearLabel(y: number): string {
  return y > 0 ? `${y}年` : `公元前${1 - y}年`
}
// One decimal place, but drop a trailing ".0" so whole magnitudes stay clean
// (1.2 → "1.2", 6600 → "6600").
function oneDecimal(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

export function formatTimePoint(tp: TimePoint): string {
  if ('ago' in tp) {
    const ago = tp.ago
    const abs = Math.abs(ago)
    // Distances under half the precision's own unit are noise at this scale
    // (e.g. ~2026 years against a billion-year tick) → "现在", not a tiny number.
    if (abs < PRECISION_YEARS[tp.precision] / 2) return '现在'
    const dir = ago > 0 ? '前' : '后' // future points read "…年后", never negative "年前"
    if (abs >= 1e8) return `约${(abs / 1e8).toFixed(1)}亿年${dir}`
    if (abs >= 1e4) return `约${oneDecimal(abs / 1e4)}万年${dir}`
    return `约${Math.round(abs)}年${dir}`
  }
  const c = tp.civil
  // Degraded-data guard: a fine precision should always carry `civil`, but a
  // malformed point (e.g. fromYear(2026, 'day')) may not. Fall back to the
  // year label rather than dereferencing an absent civil and throwing.
  if (CIVIL_REQUIRED.includes(tp.precision) && !c) return yearLabel(tp.year)
  switch (tp.precision) {
    case 'second':
      return `${yearNum(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)} ${pad(c!.h ?? 0)}:${pad(c!.mi ?? 0)}:${pad(c!.s ?? 0)}`
    case 'minute':
      return `${yearNum(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)} ${pad(c!.h ?? 0)}:${pad(c!.mi ?? 0)}`
    case 'hour':
      return `${yearNum(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)} ${pad(c!.h ?? 0)}时`
    case 'day':
      return `${yearNum(c!.y)}-${pad(c!.mo)}-${pad(c!.d!)}`
    case 'month':
      return `${yearNum(c!.y)}-${pad(c!.mo)}`
    case 'year':
      return yearLabel(tp.year)
    case 'decade':
      return tp.year > 0 ? `${tp.year}年代` : `公元前${1 - tp.year}年代`
    case 'century':
      return tp.year >= 0
        ? `${Math.floor(tp.year / 100) + 1}世纪`
        : `公元前${Math.floor(-tp.year / 100) + 1}世纪`
    case 'millennium':
      return `${yearLabel(tp.year)}起千年`
    default:
      return yearLabel(tp.year)
  }
}
