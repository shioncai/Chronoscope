import { describe, it, expect } from 'vitest'
import { packRows } from './packing'

// A pack item. Pixel box defaults to [tStart, tEnd] so cases that don't care
// about labels never collide by accident; pass left/right to model wide labels.
function item(id: string, tStart: number, tEnd: number, left = tStart, right = tEnd) {
  return { id, tStart, tEnd, left, right }
}
const rowsById = (out: { id: string; row: number }[]) =>
  Object.fromEntries(out.map((x) => [x.id, x.row]))

describe('packRows', () => {
  it('puts time-disjoint, pixel-disjoint items on row 0', () => {
    const out = packRows([item('a', 0, 10), item('b', 20, 30)])
    expect(rowsById(out)).toEqual({ a: 0, b: 0 })
  })

  it('drops a later-starting overlapper strictly below an earlier one', () => {
    // A short & earliest, B long, C overlaps only B. The old minimize-rows
    // packer reused A's freed row for C (c:0) — the new rule forbids that.
    const out = packRows([item('A', 0, 10), item('B', 5, 100), item('C', 12, 20)])
    expect(rowsById(out)).toEqual({ A: 0, B: 1, C: 2 })
  })

  it('floats a period above the scattered point events inside it', () => {
    const out = packRows([
      item('P', 0, 100),
      item('a', 10, 10),
      item('b', 40, 40),
      item('c', 70, 70),
    ])
    const r = rowsById(out)
    expect(r.P).toBe(0)
    // disjoint, non-colliding points share the single row just below the period
    expect(r.a).toBe(1)
    expect(r.b).toBe(1)
    expect(r.c).toBe(1)
  })

  it('puts the longer of two same-start events on top', () => {
    const out = packRows([item('short', 0, 20), item('long', 0, 80)])
    expect(rowsById(out)).toEqual({ short: 1, long: 0 })
  })

  it('compacts non-overlapping siblings whose labels collide onto few rows', () => {
    // Points inside a period, each with a ~25px-wide label to its right; the
    // colliding ones stagger to row 2, the rest reuse row 1.
    const out = packRows([
      item('P', 0, 100, 0, 100),
      item('a', 10, 10, 10, 35),
      item('b', 20, 20, 20, 45), // label collides a (35 > 20) -> row 2
      item('c', 40, 40, 40, 65), // clears a (35 <= 40) -> back to row 1
      item('d', 50, 50, 50, 75), // collides c (65 > 50) -> row 2
    ])
    expect(rowsById(out)).toEqual({ P: 0, a: 1, b: 2, c: 1, d: 2 })
  })

  it('lets two eras that merely touch at a boundary share a row', () => {
    // A.tEnd == B.tStart, both positive-duration -> not overlapping.
    const out = packRows([item('A', 0, 50), item('B', 50, 100)])
    expect(rowsById(out)).toEqual({ A: 0, B: 0 })
  })

  it('treats a point on a span boundary as inside it', () => {
    const out = packRows([item('S', 0, 50), item('p', 50, 50)])
    expect(rowsById(out)).toEqual({ S: 0, p: 1 })
  })

  it('stacks two same-instant points deterministically by input order', () => {
    const out = packRows([item('first', 30, 30), item('second', 30, 30)])
    expect(rowsById(out)).toEqual({ first: 0, second: 1 })
  })

  it('keeps a long span constraining items that start long after the short ones ended', () => {
    // Guards the overlap scan's pruning: `short` may be dropped once we are past
    // its end, but `era` must still force every later overlapper below it.
    const out = packRows([
      item('era', 0, 1000),
      item('short', 1, 2),
      item('late', 900, 950),
    ])
    const r = rowsById(out)
    expect(r.era).toBe(0)
    expect(r.late).toBeGreaterThan(r.era) // still constrained by the era
  })

  it('does not mutate the input array order', () => {
    const input = [item('z', 100, 110), item('a', 0, 10)]
    packRows(input)
    expect(input.map((x) => x.id)).toEqual(['z', 'a'])
  })
})
