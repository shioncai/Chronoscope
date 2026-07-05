import { describe, it, expect } from 'vitest'
import { positionFlyout } from './positionFlyout'

const vp = { width: 1000, height: 800 }

describe('positionFlyout', () => {
  it('prefers the right when there is room', () => {
    const p = positionFlyout({ left: 100, top: 100, width: 40, height: 20 }, { width: 120, height: 100 }, vp)
    expect(p.placement).toBe('right')
    expect(p.left).toBe(148) // 100 + 40 + gap(8)
    expect(p.top).toBe(100)
  })
  it('flips to the left near the right edge', () => {
    const p = positionFlyout({ left: 900, top: 100, width: 40, height: 20 }, { width: 120, height: 100 }, vp)
    expect(p.placement).toBe('left')
    expect(p.left).toBe(772) // 900 - gap(8) - 120
  })
  it('drops below when neither side fits (narrow viewport)', () => {
    const p = positionFlyout({ left: 100, top: 100, width: 120, height: 20 }, { width: 200, height: 100 }, { width: 320, height: 800 })
    expect(p.placement).toBe('below')
    expect(p.top).toBe(128) // 100 + 20 + gap(8)
  })
  it('clamps a below-placement left edge into the viewport margin', () => {
    const p = positionFlyout({ left: 2, top: 100, width: 300, height: 20 }, { width: 260, height: 100 }, { width: 300, height: 800 })
    expect(p.placement).toBe('below')
    expect(p.left).toBe(8) // clamped to margin
  })
})
