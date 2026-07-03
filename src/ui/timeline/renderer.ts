import type { TimelineScene } from './scene'

export interface TimelineColors {
  bg: string
  surface: string
  text: string
  muted: string
  border: string
  accent: string
  now: string
  deepTime: string
}

export interface TimelineLayout {
  height: number
  tickLabelH: number
  glyphTop: number
  rowHeight: number
  overviewTop: number
  overviewHeight: number
  fontSize: number
  dotRadius: number
  barHeight: number
}

const OVERVIEW_HEIGHT = 48
// The overview band is fixed-height navigator chrome, so its end labels keep a
// fixed size instead of growing with the content magnification (which would push
// the text above the band's top edge at high zoom).
const OVERVIEW_LABEL_PX = 11

export function computeLayout(height: number, scale = 1): TimelineLayout {
  return {
    height,
    tickLabelH: 18 * scale,
    glyphTop: 24 * scale,
    rowHeight: 16 * scale,
    overviewTop: height - OVERVIEW_HEIGHT,
    overviewHeight: OVERVIEW_HEIGHT,
    fontSize: 11 * scale,
    dotRadius: 4 * scale,
    barHeight: 8 * scale,
  }
}

export function densityHeight(count: number, maxCount: number): number {
  if (maxCount <= 1) return 1
  return 0.4 + 0.6 * (Math.log(count + 1) / Math.log(maxCount + 1))
}

function parseHex(h: string): [number, number, number] {
  let s = h.replace('#', '')
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

export function mixHex(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t))
  const pa = parseHex(a)
  const pb = parseHex(b)
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${hex(pa[0] + (pb[0] - pa[0]) * k)}${hex(pa[1] + (pb[1] - pa[1]) * k)}${hex(pa[2] + (pb[2] - pa[2]) * k)}`
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: TimelineScene,
  colors: TimelineColors,
  layout: TimelineLayout,
  scrollY = 0,
): void {
  ctx.clearRect(0, 0, scene.width, layout.height)
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, scene.width, layout.height)
  ctx.font = `${layout.fontSize}px ui-monospace, monospace`
  ctx.lineWidth = 1

  // ticks (vertical guides + labels) across the detail area
  const detailBottom = layout.overviewTop - 4
  for (const t of scene.detail.ticks) {
    ctx.strokeStyle = colors.border
    ctx.beginPath()
    ctx.moveTo(t.x, layout.tickLabelH)
    ctx.lineTo(t.x, detailBottom)
    ctx.stroke()
    ctx.fillStyle = colors.muted
    ctx.fillText(t.label, t.x + 3, layout.fontSize)
  }

  // glyphs (offset by the vertical scroll position). uncategorized glyphs (no
  // category color) fall back to muted gray — the same neutral as the 未分类
  // folder's dot. The side/truncation of each label is already decided in the
  // scene, so it never crosses either edge; skip a dropped label.
  //
  // Clip glyph drawing to the detail band so scrolled-out rows never paint over
  // the fixed tick strip or the overview band.
  const glyphBandTop = layout.tickLabelH
  const glyphBandBottom = layout.overviewTop - 4
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, glyphBandTop, scene.width, glyphBandBottom - glyphBandTop)
  ctx.clip()
  for (const g of scene.detail.glyphs) {
    const y = layout.glyphTop + g.row * layout.rowHeight - scrollY
    const color = g.selected ? colors.now : (g.color ?? colors.muted)
    const r = layout.dotRadius
    const bh = layout.barHeight

    // fuzzy whiskers — horizontal lines first (the core will sit on top)
    ctx.strokeStyle = colors.muted
    for (const w of g.whiskers) {
      if (w.hi <= w.lo) continue
      ctx.beginPath()
      ctx.moveTo(w.lo, y + r)
      ctx.lineTo(w.hi, y + r)
      ctx.stroke()
    }

    // core glyph
    ctx.fillStyle = color
    if (g.kind === 'span') {
      ctx.fillRect(g.xStart, y, Math.max(2, g.xEnd - g.xStart), bh)
    } else {
      ctx.beginPath()
      ctx.arc(g.xStart, y + r, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // end caps on top of the core, so inner caps stay visible (taller than the bar)
    ctx.strokeStyle = colors.muted
    for (const w of g.whiskers) {
      if (w.hi <= w.lo) continue
      ctx.beginPath()
      ctx.moveTo(w.lo, y - (r - 1))
      ctx.lineTo(w.lo, y + bh + (r - 1))
      ctx.moveTo(w.hi, y - (r - 1))
      ctx.lineTo(w.hi, y + bh + (r - 1))
      ctx.stroke()
    }

    // title — scene already chose the side and (if needed) truncated it
    if (g.label.side !== 'none' && g.label.text) {
      ctx.fillStyle = colors.text
      ctx.textAlign = g.label.side === 'left' ? 'right' : 'left'
      ctx.fillText(g.label.text, g.label.x, y + bh)
      ctx.textAlign = 'left'
    }
  }
  ctx.restore()

  // scroll indicator: a faint thumb on the right when the rows overflow the band
  const visibleH = layout.overviewTop - layout.glyphTop
  const contentH = scene.detail.rowCount * layout.rowHeight
  if (contentH > visibleH) {
    const trackH = visibleH
    const thumbH = Math.max(20, (trackH * visibleH) / contentH)
    const maxScroll = contentH - visibleH
    const thumbY = layout.glyphTop + (trackH - thumbH) * (maxScroll > 0 ? Math.min(1, scrollY / maxScroll) : 0)
    ctx.globalAlpha = 0.35
    ctx.fillStyle = colors.muted
    ctx.fillRect(scene.width - 4, thumbY, 3, thumbH)
    ctx.globalAlpha = 1
  }

  // overview band — surface, then a faint deep-time→now temperature wash
  ctx.fillStyle = colors.surface
  ctx.fillRect(0, layout.overviewTop, scene.width, layout.overviewHeight)
  const wash = ctx.createLinearGradient(0, 0, scene.width, 0)
  wash.addColorStop(0, colors.deepTime)
  wash.addColorStop(1, colors.now)
  ctx.globalAlpha = 0.1
  ctx.fillStyle = wash
  ctx.fillRect(0, layout.overviewTop, scene.width, layout.overviewHeight)
  ctx.globalAlpha = 1

  const midY = layout.overviewTop + layout.overviewHeight / 2
  const maxHalf = layout.overviewHeight / 2 - 6
  const maxCount = scene.overview.markers.reduce((m, k) => Math.max(m, k.count), 1)
  for (const m of scene.overview.markers) {
    const depth = scene.width > 0 ? m.x / scene.width : 0
    ctx.strokeStyle = mixHex(colors.deepTime, colors.now, depth)
    const half = maxHalf * densityHeight(m.count, maxCount)
    ctx.beginPath()
    ctx.moveTo(m.x, midY - half)
    ctx.lineTo(m.x, midY + half)
    ctx.stroke()
  }

  // lens window
  const { x0, x1 } = scene.overview.lens
  ctx.globalAlpha = 0.18
  ctx.fillStyle = colors.now
  ctx.fillRect(x0, layout.overviewTop, Math.max(2, x1 - x0), layout.overviewHeight)
  ctx.globalAlpha = 1
  ctx.strokeStyle = colors.now
  ctx.strokeRect(x0, layout.overviewTop, Math.max(2, x1 - x0), layout.overviewHeight)

  // current overview time range — labelled at both ends of the band, on top.
  // Fixed size (see OVERVIEW_LABEL_PX) so the text stays clear of the band's top
  // edge at any magnification.
  ctx.font = `${OVERVIEW_LABEL_PX}px ui-monospace, monospace`
  ctx.fillStyle = colors.muted
  const ry = layout.overviewTop + 12
  ctx.fillText(scene.overview.range.start, 4, ry)
  const end = scene.overview.range.end
  ctx.fillText(end, scene.width - ctx.measureText(end).width - 4, ry)
}
