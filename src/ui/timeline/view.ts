import { type LinearView, projectLinear, unprojectLinear } from '../../domain/time'

export interface Lens {
  f0: number
  f1: number
}

export const MIN_RANGE_YEARS = 1 / 365

export function initialView(instants: number[], nowYear: number): LinearView {
  return fitRange(instants, { min: nowYear - 100, max: nowYear + 10 }, 50)
}

/**
 * The view that fits a set of positions (in the axis coordinate), padded by
 * `pad` of its width on each side. A single position — or none — gets
 * `degenerate` of room either side instead, or the fallback when empty.
 */
export function fitRange(us: number[], fallback: LinearView, degenerate: number, pad = 0.05): LinearView {
  if (us.length === 0) return fallback
  let lo = Infinity
  let hi = -Infinity
  for (const u of us) {
    if (u < lo) lo = u
    if (u > hi) hi = u
  }
  if (hi - lo < 1e-9) {
    lo -= degenerate
    hi += degenerate
  }
  const p = (hi - lo) * pad
  return { min: lo - p, max: hi + p }
}

export function zoomView(view: LinearView, anchorFraction: number, factor: number, minSpan = MIN_RANGE_YEARS): LinearView {
  const range = view.max - view.min
  const anchorYear = view.min + anchorFraction * range
  const newRange = Math.max(range * factor, minSpan)
  return {
    min: anchorYear - anchorFraction * newRange,
    max: anchorYear + (1 - anchorFraction) * newRange,
  }
}

export function panView(view: LinearView, deltaFraction: number): LinearView {
  const shift = (view.max - view.min) * deltaFraction
  return { min: view.min + shift, max: view.max + shift }
}

// Keep the view inside the navigable range [lo, hi] by TRANSLATING it (never
// by truncating one edge), so panning into a boundary slides the window rather
// than silently rescaling it (changing zoom). The window also can't be wider
// than the whole range.
export function clampView(view: LinearView, lo: number, hi: number, minSpan = MIN_RANGE_YEARS): LinearView {
  let width = Math.max(view.max - view.min, minSpan)
  const span = hi - lo
  if (width > span) width = span
  let min = view.min
  let max = min + width
  if (min < lo) {
    min = lo
    max = lo + width
  } else if (max > hi) {
    max = hi
    min = hi - width
  }
  return { min, max }
}

// The overview is a LINEAR axis over `overview` (its currently shown extent,
// itself zoomable/pannable within the data bounds). Because the mapping is
// linear, the lens — the detail view projected onto it — keeps a CONSTANT width
// while the view pans; the width only changes when you zoom the view.
export function lensFromView(view: LinearView, overview: LinearView): Lens {
  const a = projectLinear(view.min, overview)
  const b = projectLinear(view.max, overview)
  return { f0: Math.min(a, b), f1: Math.max(a, b) }
}

// Clamp a vertical scroll offset into the scrollable range. When the content is
// shorter than the viewport there is nothing to scroll, so it pins to 0.
export function clampScroll(scrollY: number, contentHeight: number, viewHeight: number): number {
  const max = Math.max(0, contentHeight - viewHeight)
  return Math.min(Math.max(scrollY, 0), max)
}

// Jump the detail window so its centre sits at the year under `centerFraction`
// of the (linear) overview, keeping the current range (zoom) fixed. Used by a
// click on the overview — an absolute "go there".
export function viewFromLensCenter(view: LinearView, centerFraction: number, overview: LinearView): LinearView {
  const center = unprojectLinear(centerFraction, overview)
  const half = (view.max - view.min) / 2
  return { min: center - half, max: center + half }
}

// Pan the detail window by a drag delta measured in overview fractions. On the
// linear overview this is a pure translation (delta·overviewSpan years), so the
// range (zoom) is preserved exactly, delta 0 is a no-op (no jump), and the lens
// keeps its width while it tracks the cursor. Used while dragging the lens.
export function panViewByLensDrag(view: LinearView, deltaFraction: number, overview: LinearView): LinearView {
  const shift = deltaFraction * (overview.max - overview.min)
  return { min: view.min + shift, max: view.max + shift }
}
