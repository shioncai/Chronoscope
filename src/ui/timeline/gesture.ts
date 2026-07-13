// Pure helpers for interpreting a multi-touch pinch on the timeline canvas.
// The view layer owns the pointer map; these turn raw finger positions into the
// scalars the zoom math needs.

export interface Finger {
  x: number
  y: number
}

/**
 * How far apart the fingers are — their true distance, not the width of their
 * shadow on the time axis.
 *
 * Projecting onto x alone looks tempting on a horizontal timeline, and it is
 * wrong: two fingers stacked vertically are ~0 apart under that measure, so the
 * frame-to-frame ratio of one noisy near-zero number to the next explodes, and
 * an up-and-down pinch flails between zooming 13x in and 14x out. A pinch of a
 * given size must scale by the same amount whichever way the hand is turned.
 */
export function spreadOf(fingers: Finger[]): number {
  if (fingers.length < 2) return 0
  let max = 0
  for (let i = 0; i < fingers.length; i++) {
    for (let j = i + 1; j < fingers.length; j++) {
      max = Math.max(max, Math.hypot(fingers[i].x - fingers[j].x, fingers[i].y - fingers[j].y))
    }
  }
  return max
}

export function pinchScale(prevSpread: number, nextSpread: number): number {
  if (prevSpread <= 0) return 1
  return nextSpread / prevSpread
}

export function midpointOf(fingers: Finger[]): Finger {
  if (fingers.length === 0) return { x: 0, y: 0 }
  let sx = 0
  let sy = 0
  for (const f of fingers) {
    sx += f.x
    sy += f.y
  }
  return { x: sx / fingers.length, y: sy / fingers.length }
}
