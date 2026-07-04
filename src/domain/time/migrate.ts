import { PRECISION_YEARS, isRelativePrecision } from './precision'
import { type TimePoint, fromAgo } from './timepoint'

// Legacy deep-time points were stored as year = nowYear - ago (absolute), which
// froze the entry-time nowYear and its float noise into the record. Recover the
// intended offset and snap to 10 significant figures — far finer than any real
// ka/Ma/Ga input, but above the noise floor — matching the editor's own rounding.
export function migrateTimePoint(tp: TimePoint, nowYear: number): TimePoint {
  if ('ago' in tp) return tp
  if (!isRelativePrecision(tp.precision)) return tp
  const unit = PRECISION_YEARS[tp.precision]
  const mag = Number(((nowYear - tp.year) / unit).toPrecision(10))
  const next = fromAgo(mag * unit, tp.precision)
  return tp.fuzz ? { ...next, fuzz: tp.fuzz } : next
}

// Migrate an event's start/end. Returns a new record when anything changed,
// else null (so callers can skip untouched rows).
export function migrateEventTimes<T extends { start?: TimePoint; end?: TimePoint }>(
  e: T,
  nowYear: number,
): T | null {
  const start = e.start ? migrateTimePoint(e.start, nowYear) : e.start
  const end = e.end ? migrateTimePoint(e.end, nowYear) : e.end
  if (start === e.start && end === e.end) return null
  return { ...e, start, end }
}
