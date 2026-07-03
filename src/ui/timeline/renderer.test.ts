import { describe, it, expect } from 'vitest'
import { drawScene, computeLayout, densityHeight, mixHex, type TimelineColors } from './renderer'
import type { TimelineScene } from './scene'

const COLORS: TimelineColors = {
  bg: '#000', surface: '#111', text: '#fff', muted: '#888',
  border: '#333', accent: '#0aa', now: '#0ff', deepTime: '#a40',
}

// Minimal recording double for a 2D context — records method calls (with arg
// arrays) and style assignments so we can assert what was drawn without a real
// canvas.
function fakeCtx() {
  const calls: string[] = []
  const styles: string[] = []
  const fills: string[] = []
  const args: Record<string, unknown[][]> = {}
  const method = (name: string) => (...a: unknown[]) => {
    calls.push(`${name}(${a.length})`)
    ;(args[name] ??= []).push(a)
  }
  const ctx = {
    calls,
    styles,
    args,
    clearRect: method('clearRect'),
    beginPath: method('beginPath'),
    moveTo: method('moveTo'),
    lineTo: method('lineTo'),
    stroke: method('stroke'),
    fillRect: method('fillRect'),
    strokeRect: method('strokeRect'),
    arc: method('arc'),
    fill: method('fill'),
    fillText: method('fillText'),
    save: method('save'),
    restore: method('restore'),
    clip: method('clip'),
    rect: method('rect'),
    measureText: (...a: unknown[]) => {
      calls.push(`measureText(${a.length})`)
      return { width: 10 }
    },
    createLinearGradient: (...a: unknown[]) => {
      calls.push(`createLinearGradient(${a.length})`)
      return { addColorStop: () => {} }
    },
    set fillStyle(v: string) { fills.push(v) },
    set strokeStyle(v: string) { styles.push(v) },
    set font(_v: string) {},
    set lineWidth(_v: number) {},
    set globalAlpha(_v: number) {},
    set textAlign(_v: string) {},
  }
  return Object.assign(ctx, { fills }) as unknown as CanvasRenderingContext2D & {
    calls: string[]
    styles: string[]
    fills: string[]
    args: Record<string, unknown[][]>
  }
}

const scene: TimelineScene = {
  width: 1000,
  detail: {
    ticks: [{ x: 100, label: '2000年' }, { x: 500, label: '2050年' }],
    glyphs: [
      { eventId: 'a', kind: 'span', xStart: 100, xEnd: 300, whiskers: [{ lo: 80, hi: 120 }, { lo: 280, hi: 320 }], row: 0, selected: false, label: { text: 'A', side: 'right', x: 326 } },
      { eventId: 'b', kind: 'point', xStart: 500, xEnd: 500, whiskers: [{ lo: 480, hi: 520 }], row: 1, selected: true, label: { text: 'B', side: 'right', x: 526 } },
    ],
    rowCount: 2,
  },
  overview: {
    markers: [{ x: 100, count: 1, eventId: 'a' }, { x: 900, count: 1, eventId: 'b' }],
    lens: { x0: 200, x1: 600 },
    range: { start: '约5.0亿年前', end: '2026年' },
  },
}

describe('renderer', () => {
  it('computeLayout reserves an overview band at the bottom', () => {
    const l = computeLayout(400)
    expect(l.overviewHeight).toBe(48)
    expect(l.overviewTop).toBe(400 - 48)
    expect(l.glyphTop).toBeGreaterThan(l.tickLabelH - 1)
  })
  it('densityHeight scales from a floor up to the full band by count', () => {
    expect(densityHeight(1, 1)).toBe(1) // no clustering anywhere → full height
    expect(densityHeight(1, 10)).toBeGreaterThanOrEqual(0.4)
    expect(densityHeight(10, 10)).toBeCloseTo(1, 6)
    expect(densityHeight(2, 10)).toBeLessThan(densityHeight(8, 10))
  })
  describe('mixHex', () => {
    it('returns the endpoints at t=0 and t=1', () => {
      expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
      expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
    })
    it('blends channels at the midpoint', () => {
      expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    })
    it('clamps t outside [0,1]', () => {
      expect(mixHex('#000000', '#ffffff', -1)).toBe('#000000')
      expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff')
    })
    it('expands 3-digit shorthand hex', () => {
      expect(mixHex('#000', '#fff', 1)).toBe('#ffffff')
    })
  })
  it('scales every pixel dimension by the magnification factor', () => {
    const l1 = computeLayout(400, 1)
    const l2 = computeLayout(400, 2)
    expect(l2.rowHeight).toBeCloseTo(l1.rowHeight * 2, 6)
    expect(l2.fontSize).toBeCloseTo(l1.fontSize * 2, 6)
    expect(l2.dotRadius).toBeCloseTo(l1.dotRadius * 2, 6)
    expect(l2.barHeight).toBeCloseTo(l1.barHeight * 2, 6)
    expect(l2.glyphTop).toBeCloseTo(l1.glyphTop * 2, 6)
    expect(l2.overviewHeight).toBe(48) // the overview band is fixed, not scaled
  })
  it('draws a label on the left when side is left', () => {
    const ctx = fakeCtx()
    const s: TimelineScene = {
      ...scene,
      detail: { ...scene.detail, glyphs: [{ ...scene.detail.glyphs[0], label: { text: 'L', side: 'left', x: 94 } }] },
    }
    drawScene(ctx, s, COLORS, computeLayout(400))
    const texts = (ctx.args.fillText ?? []).map((a) => a[0])
    expect(texts).toContain('L')
  })
  it('skips drawing a dropped label (side none)', () => {
    const ctx = fakeCtx()
    const s: TimelineScene = {
      ...scene,
      detail: { ...scene.detail, glyphs: [{ ...scene.detail.glyphs[0], label: { text: '', side: 'none', x: 0 } }] },
    }
    drawScene(ctx, s, COLORS, computeLayout(400))
    const texts = (ctx.args.fillText ?? []).map((a) => a[0])
    // ticks (2) + overview range (2) still drawn, but no glyph title
    expect(texts).not.toContain('A')
    expect(texts.filter((t) => t === '').length).toBe(0)
  })
  it('draws ticks, a span rect, a point arc, labels, and the lens', () => {
    const ctx = fakeCtx()
    drawScene(ctx, scene, COLORS, computeLayout(400))
    const count = (name: string) => ctx.calls.filter((c) => c.startsWith(name + '(')).length
    expect(count('clearRect')).toBe(1)
    expect(count('fillRect')).toBe(5) // bg + span glyph + overview band + band wash + lens fill
    expect(count('arc')).toBe(1) // one point glyph
    expect(count('strokeRect')).toBe(1) // lens border
    expect(count('fillText')).toBe(6) // 2 tick labels + 2 glyph titles + 2 overview range labels
  })
  it('washes the overview with a deep-time→now gradient and colors markers by depth', () => {
    const ctx = fakeCtx()
    drawScene(ctx, scene, COLORS, computeLayout(400))
    const count = (name: string) => ctx.calls.filter((c) => c.startsWith(name + '(')).length
    expect(count('createLinearGradient')).toBe(1)
    // markers sit at x=100 and x=900 over width 1000 → depth 0.1 and 0.9
    expect(ctx.styles).toContain(mixHex(COLORS.deepTime, COLORS.now, 0.1))
    expect(ctx.styles).toContain(mixHex(COLORS.deepTime, COLORS.now, 0.9))
  })
  it('draws more line segments when endpoints have fuzz (error-bar caps)', () => {
    const withW = fakeCtx()
    drawScene(withW, scene, COLORS, computeLayout(400))
    const bare = { ...scene, detail: { ...scene.detail, glyphs: scene.detail.glyphs.map((g) => ({ ...g, whiskers: [] })) } }
    const withoutW = fakeCtx()
    drawScene(withoutW, bare, COLORS, computeLayout(400))
    const lineTos = (c: ReturnType<typeof fakeCtx>) => c.calls.filter((x) => x.startsWith('lineTo(')).length
    expect(lineTos(withW)).toBeGreaterThan(lineTos(withoutW))
  })
  it('fills a glyph with its category color, falling back to muted gray', () => {
    const ctx = fakeCtx()
    const s: TimelineScene = {
      ...scene,
      detail: {
        ...scene.detail,
        glyphs: [
          { eventId: 'a', kind: 'span', xStart: 100, xEnd: 300, whiskers: [], row: 0, selected: false, color: '#abcdef', label: { text: 'A', side: 'right', x: 306 } },
          { eventId: 'b', kind: 'point', xStart: 500, xEnd: 500, whiskers: [], row: 1, selected: false, label: { text: 'B', side: 'right', x: 506 } },
        ],
      },
    }
    drawScene(ctx, s, COLORS, computeLayout(400))
    expect(ctx.fills).toContain('#abcdef') // categorized glyph uses its color
    expect(ctx.fills).toContain(COLORS.muted) // uncategorized glyph falls back to muted gray
  })
})
