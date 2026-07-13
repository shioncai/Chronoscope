import { describe, it, expect } from 'vitest'
import { spreadOf, pinchScale, midpointOf } from './gesture'

const p = (x: number, y: number) => ({ x, y })

describe('gesture math', () => {
  it('spreadOf is how far apart the fingers are, whichever way the hand is turned', () => {
    expect(spreadOf([p(100, 50), p(300, 50)])).toBe(200) // left-right
    expect(spreadOf([p(100, 50), p(100, 250)])).toBe(200) // up-down
    expect(spreadOf([p(0, 0), p(30, 40)])).toBe(50) // diagonal (3-4-5)
    expect(spreadOf([p(200, 50)])).toBe(0) // need two
    expect(spreadOf([])).toBe(0)
  })

  // The bug that made a vertical pinch flail: measuring only the x gap reads two
  // stacked fingers as ~0 apart, and the ratio of one noisy near-zero number to
  // the next explodes. Their real distance is nothing of the sort.
  it('does not collapse when the fingers are stacked vertically', () => {
    expect(spreadOf([p(198, 100), p(202, 300)])).toBeCloseTo(200.04, 1)
  })

  it('pinchScale is the ratio of the new spread to the old', () => {
    expect(pinchScale(100, 200)).toBe(2) // fingers moved apart
    expect(pinchScale(200, 100)).toBe(0.5) // fingers pinched together
  })

  it('pinchScale is 1 when the previous spread is degenerate', () => {
    expect(pinchScale(0, 200)).toBe(1)
  })

  it('midpointOf averages the fingers in both axes', () => {
    expect(midpointOf([p(100, 20), p(300, 60)])).toEqual({ x: 200, y: 40 })
    expect(midpointOf([])).toEqual({ x: 0, y: 0 })
  })
})
