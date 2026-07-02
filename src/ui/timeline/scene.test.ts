import { describe, it, expect } from 'vitest'
import { buildScene, eventInstant, aggregateMarkers } from './scene'
import { ev, y } from '../../test/fixtures'
import { withFuzz } from '../../domain/time'

const base = { view: { min: 2000, max: 2100 }, overview: { min: 2000, max: 2100 }, nowYear: 2026, width: 1000, selectedId: null }

describe('eventInstant', () => {
  it('prefers start, falls back to end, else null', () => {
    expect(eventInstant(ev({ id: 'a', start: y(1969) }))).toBe(1969)
    expect(eventInstant(ev({ id: 'b', end: y(1980) }))).toBe(1980)
    expect(eventInstant(ev({ id: 'c' }))).toBeNull()
  })
})

describe('buildScene', () => {
  it('places a point event at the projected x', () => {
    const scene = buildScene({ ...base, events: [ev({ id: 'p', start: y(2050) })] })
    const g = scene.detail.glyphs.find((x) => x.eventId === 'p')!
    expect(g.kind).toBe('point')
    expect(g.xStart).toBeCloseTo(500, 0) // (2050-2000)/100 * 1000
    expect(g.xEnd).toBeCloseTo(g.xStart, 6)
  })
  it('builds a span between start and end', () => {
    const scene = buildScene({ ...base, events: [ev({ id: 's', start: y(2025), end: y(2075) })] })
    const g = scene.detail.glyphs.find((x) => x.eventId === 's')!
    expect(g.kind).toBe('span')
    expect(g.xStart).toBeCloseTo(250, 0)
    expect(g.xEnd).toBeCloseTo(750, 0)
  })
  it('culls events entirely outside the view', () => {
    const scene = buildScene({ ...base, events: [ev({ id: 'far', start: y(1000) })] })
    expect(scene.detail.glyphs).toEqual([])
  })
  it('stacks overlapping events into rows', () => {
    const scene = buildScene({
      ...base,
      events: [ev({ id: 'a', start: y(2010), end: y(2060) }), ev({ id: 'b', start: y(2020), end: y(2070) })],
    })
    expect(scene.detail.rowCount).toBe(2)
    expect(new Set(scene.detail.glyphs.map((g) => g.row))).toEqual(new Set([0, 1]))
  })
  it('marks the selected event', () => {
    const scene = buildScene({ ...base, selectedId: 'p', events: [ev({ id: 'p', start: y(2050) })] })
    expect(scene.detail.glyphs[0].selected).toBe(true)
  })
  it('produces overview markers and a lens within the width', () => {
    const scene = buildScene({ ...base, events: [ev({ id: 'p', start: y(2050) })] })
    expect(scene.overview.markers.map((m) => m.eventId)).toEqual(['p'])
    expect(scene.overview.lens.x0).toBeGreaterThanOrEqual(0)
    expect(scene.overview.lens.x1).toBeLessThanOrEqual(base.width)
    expect(scene.overview.lens.x0).toBeLessThan(scene.overview.lens.x1)
  })
  it('keeps the lens inside the band when the view is outside the overview extent', () => {
    // overview zoomed onto an older window; the detail view lies entirely to its right
    const right = buildScene({ ...base, overview: { min: 1000, max: 1100 }, view: { min: 2000, max: 2100 }, events: [] })
    expect(right.overview.lens.x0).toBeGreaterThanOrEqual(0)
    expect(right.overview.lens.x1).toBeLessThanOrEqual(base.width)
    expect(right.overview.lens.x1 - right.overview.lens.x0).toBeGreaterThanOrEqual(2) // still visible
    // ...and entirely to its left
    const left = buildScene({ ...base, overview: { min: 3000, max: 3100 }, view: { min: 2000, max: 2100 }, events: [] })
    expect(left.overview.lens.x0).toBeGreaterThanOrEqual(0)
    expect(left.overview.lens.x1).toBeLessThanOrEqual(base.width)
  })
  it('labels the overview band with its current time range', () => {
    const scene = buildScene({ ...base, events: [] })
    expect(scene.overview.range.start).toBe('2000年')
    expect(scene.overview.range.end).toBe('2100年')
  })
  it('uses a relative label for a deep-time overview bound', () => {
    const scene = buildScene({ ...base, overview: { min: 2026 - 5e8, max: 2026 - 1e6 }, events: [] })
    expect(scene.overview.range.start).toBe('约5.0亿年前')
    expect(scene.overview.range.end).toBe('约100万年前')
  })
  it('labels ticks and keeps them within the width', () => {
    const scene = buildScene({ ...base, events: [] })
    expect(scene.detail.ticks.length).toBeGreaterThan(0)
    for (const t of scene.detail.ticks) {
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.x).toBeLessThanOrEqual(base.width)
      expect(typeof t.label).toBe('string')
    }
  })
  it('thins ticks to a minimum pixel gap so labels do not overlap at narrow widths', () => {
    const scene = buildScene({
      ...base,
      width: 360,
      events: [],
      view: { min: 2026 - 1.4e10, max: 2026 },
      overview: { min: 2026 - 1.4e10, max: 2026 },
    })
    const xs = scene.detail.ticks.map((t) => t.x)
    expect(xs.length).toBeGreaterThan(0)
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(80)
  })
  it('emits a whisker segment for a fuzzy endpoint and none for a crisp one', () => {
    const crisp = buildScene({ ...base, events: [ev({ id: 'p', start: y(2050) })] })
    expect(crisp.detail.glyphs[0].whiskers).toEqual([])
    const s = buildScene({ ...base, events: [ev({ id: 'q', start: withFuzz(y(2050), { before: 5, after: 5 }) })] })
    expect(s.detail.glyphs[0].whiskers.length).toBe(1)
    expect(s.detail.glyphs[0].whiskers[0].hi).toBeGreaterThan(s.detail.glyphs[0].whiskers[0].lo)
  })
  it('emits two independent whisker segments for a span with both endpoints fuzzy', () => {
    const s = buildScene({
      ...base,
      events: [ev({ id: 'sp', start: withFuzz(y(2025), { before: 3, after: 3 }), end: withFuzz(y(2075), { before: 4, after: 4 }) })],
    })
    expect(s.detail.glyphs[0].whiskers.length).toBe(2)
  })

  it('colors a glyph by its category', () => {
    const scene = buildScene({
      ...base,
      categoryColors: new Map([['c1', '#abcdef']]),
      events: [ev({ id: 'p', start: y(2050), categoryId: 'c1' })],
    })
    expect(scene.detail.glyphs[0].color).toBe('#abcdef')
  })

  it('leaves an uncategorized glyph color undefined', () => {
    const scene = buildScene({ ...base, events: [ev({ id: 'p', start: y(2050) })] })
    expect(scene.detail.glyphs[0].color).toBeUndefined()
  })
})

describe('aggregateMarkers', () => {
  it('clusters nearby markers into one with a count and drops the singleton id', () => {
    const out = aggregateMarkers(
      [{ x: 1, eventId: 'a' }, { x: 2, eventId: 'b' }, { x: 100, eventId: 'c' }],
      6,
    )
    expect(out.length).toBe(2)
    const big = out.find((m) => m.count === 2)!
    expect(big.eventId).toBeUndefined()
    const solo = out.find((m) => m.count === 1)!
    expect(solo.eventId).toBe('c')
  })
  it('keeps the eventId for a lone marker', () => {
    const out = aggregateMarkers([{ x: 42, eventId: 'z' }], 6)
    expect(out).toEqual([{ x: 42, count: 1, eventId: 'z' }])
  })
})
