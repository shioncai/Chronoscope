import type { Precision, AbsolutePrecision, RelativePrecision } from './precision'
import { type CivilTime, decimalFromCivil } from './decimal'

// The fixed reference for relative deep-time points (geology's "Before Present").
// A constant (not the live clock), so instantOf stays pure and a relative point's
// absolute position is reproducible and never drifts.
export const PRESENT_EPOCH = 1950

interface Fuzz {
  before: number
  after: number
}

export interface AbsoluteTime {
  year: number
  // full Precision so a pre-migration legacy `{ year, precision: 'Ma' }` is still
  // a valid TimePoint for the migration to consume; constructors below narrow it.
  precision: Precision
  civil?: CivilTime
  fuzz?: Fuzz
}

export interface RelativeTime {
  ago: number // years before PRESENT_EPOCH
  precision: RelativePrecision
  fuzz?: Fuzz
}

export type TimePoint = AbsoluteTime | RelativeTime

export function fromYear(year: number, precision: AbsolutePrecision): AbsoluteTime {
  return { year, precision }
}

export function fromAgo(ago: number, precision: RelativePrecision): RelativeTime {
  return { ago, precision }
}

export function fromCivil(civil: CivilTime, precision: AbsolutePrecision): AbsoluteTime {
  return { year: decimalFromCivil(civil), precision, civil }
}

export function instantOf(tp: TimePoint): number {
  if ('ago' in tp) return PRESENT_EPOCH - tp.ago
  return tp.civil ? decimalFromCivil(tp.civil) : tp.year
}

export function compareTimePoints(a: TimePoint, b: TimePoint): number {
  return instantOf(a) - instantOf(b)
}

// Attach (or clear) an explicit uncertainty range, in decimal years before/after
// the instant. A zero, negative, or undefined range normalizes to "no fuzz".
export function withFuzz(
  tp: TimePoint,
  fuzz: { before: number; after: number } | undefined,
): TimePoint {
  const before = fuzz && fuzz.before > 0 ? fuzz.before : 0
  const after = fuzz && fuzz.after > 0 ? fuzz.after : 0
  if (before === 0 && after === 0) {
    if (!tp.fuzz) return tp
    const copy = { ...tp }
    delete copy.fuzz
    return copy
  }
  return { ...tp, fuzz: { before, after } }
}
