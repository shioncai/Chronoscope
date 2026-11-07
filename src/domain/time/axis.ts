import type { LinearView } from './project'
import type { Locale } from '../locale'
import { generateTicks, type Tick } from './ticks'
import { formatAgeLabel } from './format'

/**
 * How decimal years map onto the axis coordinate `u` that views, zoom and pan
 * work in. Everything downstream of the axis is linear in `u`, so swapping the
 * axis swaps the whole timeline's geometry without touching the view maths.
 *
 * - linear: u is the year itself.
 * - log:    u is a symmetric log of the age from now, so the Big Bang, the
 *           Cambrian, Rome and this afternoon all fit on one screen (13.8 Ga
 *           spans ~12.7 units, about one per decade).
 */
export type AxisKind = 'linear' | 'log'

export interface TimeAxis {
  kind: AxisKind
  toU(year: number): number
  fromU(u: number): number
  /** The narrowest view (in u) zoom may reach. */
  minSpan: number
  /** Labelled ticks for a view given in u. */
  ticks(view: LinearView, maxTicks: number, locale: Locale): AxisTick[]
}

export interface AxisTick extends Tick {
  u: number
}

const DAY = 1 / 365.2425
const HOUR = DAY / 24

export function linearAxis(): TimeAxis {
  return {
    kind: 'linear',
    toU: (y) => y,
    fromU: (u) => u,
    minSpan: HOUR,
    ticks: (view, maxTicks, locale) =>
      generateTicks(view, maxTicks, locale).map((t) => ({ ...t, u: t.year })),
  }
}

// The log's linear core: ages well under a day are spaced linearly, so "now"
// is a finite point rather than -∞ and the future gets a mirror image.
const CORE = DAY

export function logAxis(nowYear: number): TimeAxis {
  const toU = (year: number): number => {
    const age = nowYear - year
    const u = Math.log10(1 + Math.abs(age) / CORE)
    return age > 0 ? -u : u // never -0: now is exactly 0
  }
  const fromU = (u: number): number => nowYear + Math.sign(u) * (10 ** Math.abs(u) - 1) * CORE
  return {
    kind: 'log',
    toU,
    fromU,
    minSpan: 1e-5,
    ticks: (view, maxTicks, locale) => logTicks(view, nowYear, toU, fromU, maxTicks, locale),
  }
}

export function axisFor(kind: AxisKind, nowYear: number): TimeAxis {
  return kind === 'log' ? logAxis(nowYear) : linearAxis()
}

// Ages a log axis labels, coarsest level first. Each level adds the finer
// candidates; the finest level that still fits `maxTicks` wins.
const LEVELS: number[][] = (() => {
  const decades = Array.from({ length: 11 }, (_, k) => 10 ** k) // 1 yr … 10 Ga
  const by = (ms: number[]) => decades.flatMap((d) => ms.map((m) => m * d))
  return [
    [DAY, 1 / 12, ...decades],
    [HOUR, DAY, 7 * DAY, 1 / 12, 0.5, ...by([1, 2, 5])],
    [HOUR, 6 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 1 / 12, 3 / 12, 0.5, ...by([1, 2, 3, 4, 5, 6, 7, 8, 9])],
  ]
})()

function logTicks(
  view: LinearView,
  nowYear: number,
  toU: (y: number) => number,
  fromU: (u: number) => number,
  maxTicks: number,
  locale: Locale,
): AxisTick[] {
  const yMin = fromU(view.min)
  const yMax = fromU(view.max)
  // Zoomed in far enough, the log is locally almost straight: hand over to the
  // calendar ticks, which can say "2026-03-15 14:00" instead of "3 h ago".
  const ageA = Math.abs(nowYear - yMin)
  const ageB = Math.abs(nowYear - yMax)
  const straddles = yMin < nowYear && yMax > nowYear
  const near = straddles ? 0 : Math.min(ageA, ageB)
  const far = Math.max(ageA, ageB)
  if ((CORE + far) / (CORE + near) < 4) {
    return generateTicks({ min: yMin, max: yMax }, maxTicks, locale).map((t) => ({ ...t, u: toU(t.year) }))
  }

  const inView = (u: number) => u >= view.min && u <= view.max
  const collect = (ages: number[]): AxisTick[] => {
    const out: AxisTick[] = []
    for (const a of ages) {
      for (const age of [a, -a]) {
        const year = nowYear - age
        const u = toU(year)
        if (inView(u)) out.push({ u, year, label: formatAgeLabel(age, locale) })
      }
    }
    if (inView(0)) out.push({ u: 0, year: nowYear, label: formatAgeLabel(0, locale) })
    return out.sort((p, q) => p.u - q.u)
  }

  let best = collect(LEVELS[0])
  for (const level of LEVELS.slice(1)) {
    const next = collect(level)
    if (next.length > maxTicks) break
    best = next
  }
  return best
}
