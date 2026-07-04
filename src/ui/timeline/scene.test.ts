import { describe, it, expect } from 'vitest'
import { buildScene, eventInstant, aggregateMarkers } from './scene'
import { ev, y } from '../../test/fixtures'
import { withFuzz, migrateEventTimes } from '../../domain/time'
import { labelWidth } from './labels'

const base = { view: { min: 2000, max: 2100 }, overview: { min: 2000, max: 2100 }, nowYear: 2026, width: 1000, selectedId: null }

// helper: reconstruct a glyph's occupied [left,right] from core + label
function occOf(
  g: { xStart: number; xEnd: number; label: { text: string; side: string; x: number } },
  fontPx = 11,
): [number, number] {
  const coreLeft = Math.min(g.xStart, g.xEnd)
  const coreRight = Math.max(g.xStart, g.xEnd)
  if (g.label.side === 'none' || g.label.text === '') return [coreLeft, coreRight]
  const w = labelWidth(g.label.text, fontPx)
  return g.label.side === 'left' ? [g.label.x - w, coreRight] : [coreLeft, g.label.x + w]
}

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
  it('stacks 显生宙 above 寒武纪 after migrating their same-input deep-time starts', () => {
    // The two real records both entered as "538.8 Ma ago" but stored slightly
    // different absolute years (nowYear drift). After migration they share an ago,
    // so the longer eon (显生宙) deterministically sits above 寒武纪.
    const nowY = 2026.505466
    const cam = migrateEventTimes(
      ev({ id: 'cam', title: '寒武纪', start: { year: -538797973.4962629, precision: 'Ma' as const }, end: { year: -486847973.4962629, precision: 'Ma' as const } }),
      nowY,
    )!
    const pha = migrateEventTimes(
      ev({ id: 'pha', title: '显生宙', start: { year: -538797973.494534, precision: 'Ma' as const }, end: { year: 2026.5, precision: 'Ma' as const } }),
      nowY,
    )!
    const scene = buildScene({ ...base, view: { min: -6e8, max: 2026 }, overview: { min: -6e8, max: 2026 }, events: [cam, pha] })
    const row = (id: string) => scene.detail.glyphs.find((g) => g.eventId === id)!.row
    expect(row('pha')).toBeLessThan(row('cam')) // 显生宙 (longer) on top
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

  it('stacks two point events with wide labels onto separate rows (real width, not fixed 80px)', () => {
    // two points 40px apart on a 1000px axis; each label is far wider than 40px,
    // so honest reservation must push them to different rows.
    const scene = buildScene({
      ...base,
      events: [
        ev({ id: 'a', start: y(2050), title: '前寒武纪 (Precambrian)' }),
        ev({ id: 'b', start: y(2054), title: '元古宙 (Proterozoic)' }),
      ],
    })
    const rows = scene.detail.glyphs.map((g) => g.row)
    expect(new Set(rows).size).toBe(2)
  })

  it('keeps a start-edge long label inside the viewport', () => {
    const scene = buildScene({
      ...base,
      width: 300,
      events: [ev({ id: 'e', start: y(2001), title: '一个非常长的开头事件标题 (A Very Long Leading Title)' })],
    })
    const [l, r] = occOf(scene.detail.glyphs[0])
    expect(l).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(300)
  })

  it('keeps an end-edge long label inside the viewport', () => {
    const scene = buildScene({
      ...base,
      width: 300,
      events: [ev({ id: 'e', start: y(2099), title: '一个非常长的结尾事件标题 (A Very Long Trailing Title)' })],
    })
    const [l, r] = occOf(scene.detail.glyphs[0])
    expect(l).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThanOrEqual(300)
  })

  it('never overlaps same-row labels across time-axis zoom levels', () => {
    const events = [
      ev({ id: 'a', start: y(2048), title: '前寒武纪 (Precambrian)' }),
      ev({ id: 'b', start: y(2050), title: '元古宙 (Proterozoic)' }),
      ev({ id: 'c', start: y(2052), title: '太古宙 (Archean)' }),
      ev({ id: 'd', start: y(2054), title: '冥古宙 (Hadean)' }),
    ]
    for (const span of [100, 40, 10, 2]) {
      const view = { min: 2051 - span / 2, max: 2051 + span / 2 }
      const scene = buildScene({ ...base, view, events })
      const byRow = new Map<number, [number, number][]>()
      for (const g of scene.detail.glyphs) {
        const arr = byRow.get(g.row) ?? []
        arr.push(occOf(g))
        byRow.set(g.row, arr)
      }
      for (const arr of byRow.values()) {
        arr.sort((p, q) => p[0] - q[0])
        for (let i = 1; i < arr.length; i++) {
          expect(arr[i][0]).toBeGreaterThanOrEqual(arr[i - 1][1] - 1e-6) // no overlap within a row
        }
      }
    }
  })

  it('reserves more horizontal room (more rows) as display scale grows', () => {
    const events = [
      ev({ id: 'a', start: y(2050), title: '前寒武纪 (Precambrian)' }),
      ev({ id: 'b', start: y(2058), title: '元古宙 (Proterozoic)' }),
    ]
    const small = buildScene({ ...base, scale: 1, events })
    const big = buildScene({ ...base, scale: 2.5, events })
    expect(big.detail.rowCount).toBeGreaterThanOrEqual(small.detail.rowCount)
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
