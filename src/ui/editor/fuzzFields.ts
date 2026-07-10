export type FuzzUnit = 'day' | 'year' | 'century' | 'millennium' | 'Ma' | 'Ga'

export const FUZZ_UNIT_YEARS: Record<FuzzUnit, number> = {
  day: 1 / 365.2425,
  year: 1,
  century: 100,
  millennium: 1000,
  Ma: 1e6,
  Ga: 1e9,
}

export interface FuzzFields {
  unit: FuzzUnit
  amount: string // symmetric ± value
  asymmetric: boolean
  before: string
  after: string
}

export function emptyFuzzFields(): FuzzFields {
  return { unit: 'year', amount: '', asymmetric: false, before: '', after: '' }
}

function num(s: string): number {
  const n = parseFloat(s)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function buildFuzz(f: FuzzFields): { before: number; after: number } | undefined {
  const u = FUZZ_UNIT_YEARS[f.unit]
  const before = (f.asymmetric ? num(f.before) : num(f.amount)) * u
  const after = (f.asymmetric ? num(f.after) : num(f.amount)) * u
  if (before <= 0 && after <= 0) return undefined
  return { before, after }
}

const PICK_ORDER: FuzzUnit[] = ['Ga', 'Ma', 'millennium', 'century', 'year', 'day']

export function fuzzFromValue(fuzz: { before: number; after: number } | undefined): FuzzFields {
  if (!fuzz) return emptyFuzzFields()
  const asymmetric = fuzz.before !== fuzz.after
  const mag = Math.max(fuzz.before, fuzz.after) || fuzz.before || fuzz.after
  const unit = PICK_ORDER.find((u) => mag >= FUZZ_UNIT_YEARS[u]) ?? 'year'
  const u = FUZZ_UNIT_YEARS[unit]
  const fmt = (v: number) => (v > 0 ? String(+(v / u).toFixed(4)) : '')
  return {
    unit,
    amount: asymmetric ? '' : fmt(fuzz.before),
    asymmetric,
    before: asymmetric ? fmt(fuzz.before) : '',
    after: asymmetric ? fmt(fuzz.after) : '',
  }
}
