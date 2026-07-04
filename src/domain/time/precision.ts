export type Precision =
  | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year'
  | 'decade' | 'century' | 'millennium' | 'ka' | 'Ma' | 'Ga'

export const PRECISION_ORDER: Precision[] = [
  'second', 'minute', 'hour', 'day', 'month', 'year',
  'decade', 'century', 'millennium', 'ka', 'Ma', 'Ga',
]

const YEAR_SECONDS = 31_556_952 // 365.2425 * 86400

export const PRECISION_YEARS: Record<Precision, number> = {
  second: 1 / YEAR_SECONDS,
  minute: 60 / YEAR_SECONDS,
  hour: 3600 / YEAR_SECONDS,
  day: 1 / 365.2425,
  month: 1 / 12,
  year: 1,
  decade: 10,
  century: 100,
  millennium: 1000,
  ka: 1000,
  Ma: 1_000_000,
  Ga: 1_000_000_000,
}

export function comparePrecision(a: Precision, b: Precision): number {
  return PRECISION_ORDER.indexOf(a) - PRECISION_ORDER.indexOf(b)
}

export function isFiner(a: Precision, b: Precision): boolean {
  return comparePrecision(a, b) < 0
}

// Deep-time precisions are displayed and stored *relative* to a fixed epoch (as
// an `ago` offset); everything else is an absolute calendar value.
export const RELATIVE_PRECISIONS = ['ka', 'Ma', 'Ga'] as const
export type RelativePrecision = (typeof RELATIVE_PRECISIONS)[number]
export type AbsolutePrecision = Exclude<Precision, RelativePrecision>

export function isRelativePrecision(p: Precision): p is RelativePrecision {
  return p === 'ka' || p === 'Ma' || p === 'Ga'
}
