import type { EventRecord, Id } from '../../domain/model'
import {
  type LinearView,
  type TimeAxis,
  projectLinear,
  linearAxis,
  fuzzRangeOf,
  instantOf,
  formatTimePoint,
  formatAgeLabel,
  fromYear,
  fromAgo,
  PRESENT_EPOCH,
} from '../../domain/time'
import type { Locale } from '../../domain/locale'
import { packRows } from './packing'
import { lensFromView } from './view'
import { placeLabel, labelWidth, nowChipSpan, BASE_FONT_PX } from './labels'

export interface SceneTick {
  x: number
  label: string
}

export interface SceneGlyph {
  eventId: Id
  kind: 'point' | 'span'
  xStart: number
  xEnd: number
  whiskers: { lo: number; hi: number }[]
  row: number
  selected: boolean
  hovered: boolean
  color?: string
  label: { text: string; side: 'left' | 'right' | 'none'; x: number; width: number }
}

export interface SceneMarker {
  x: number
  count: number
  eventId?: Id
}

/** A group of rows headed by a label: one top-level folder, in lane mode. */
export interface SceneLane {
  key: string
  label: string
  color?: string
  /** The header's row; the lane's glyphs sit in the `rows - 1` rows below it. */
  row: number
  rows: number
}

/** A connector from the selected event to one it links to. */
export interface SceneLink {
  x0: number
  row0: number
  x1: number
  row1: number
}

export interface TimelineScene {
  width: number
  detail: {
    ticks: SceneTick[]
    glyphs: SceneGlyph[]
    rowCount: number
    lanes: SceneLane[]
    links: SceneLink[]
    /** x of the present, when it is in view. */
    now: number | null
    nowLabel: string
  }
  overview: {
    markers: SceneMarker[]
    lens: { x0: number; x1: number }
    range: { start: string; end: string }
    now: number | null
  }
}

export interface LaneDef {
  key: string
  label: string
  color?: string
}

export interface BuildSceneInput {
  events: EventRecord[]
  /** The detail window, in the axis's u coordinate. */
  view: LinearView
  // The overview band's currently shown extent (u). The lens and the event
  // markers are projected onto this, so the user can zoom/pan it to spread out
  // a crowded era without changing the detail view.
  overview: LinearView
  nowYear: number
  width: number
  selectedId: Id | null
  hoveredId?: Id | null
  // live category id → color; a glyph's color is its event's category color
  // (undefined when the event is uncategorized or the category is missing).
  categoryColors?: Map<Id, string>
  // display magnification (1 = normal). Widens labels so packing reserves the
  // scaled width; the renderer scales the matching pixel sizes.
  scale?: number
  locale?: Locale
  axis?: TimeAxis
  /** Group glyphs into lanes, in `defs` order; events map to a lane by key. */
  lanes?: { defs: LaneDef[]; keyOf: (e: EventRecord) => string }
}

const MARKER_BUCKET_PX = 6
const MIN_LENS_PX = 2 // keep the lens visible even when it degenerates at a band edge
const TICK_PAD = 3 // the renderer draws a tick's label this far right of its line
const TICK_GAP = 12 // breathing room between one label's end and the next tick

export function aggregateMarkers(items: { x: number; eventId: Id }[], bucketPx: number): SceneMarker[] {
  const buckets = new Map<number, { x: number; eventId: Id }[]>()
  for (const it of items) {
    const key = Math.floor(it.x / bucketPx)
    const arr = buckets.get(key)
    if (arr) arr.push(it)
    else buckets.set(key, [it])
  }
  const out: SceneMarker[] = []
  for (const arr of buckets.values()) {
    const x = arr.reduce((s, it) => s + it.x, 0) / arr.length
    out.push({ x, count: arr.length, eventId: arr.length === 1 ? arr[0].eventId : undefined })
  }
  out.sort((a, b) => a.x - b.x)
  return out
}

export function eventInstant(e: EventRecord): number | null {
  if (e.start) return instantOf(e.start)
  if (e.end) return instantOf(e.end)
  return null
}

// Label a decimal year for the overview's range readout: an absolute year near
// the present, an age deeper in time.
/** How a view edge reads: an age on the log axis, a date on the linear one. */
export function rangeLabel(year: number, nowYear: number, locale: Locale, axis: TimeAxis): string {
  if (axis.kind === 'log') return formatAgeLabel(nowYear - year, locale)
  return Math.abs(nowYear - year) >= 1000
    ? formatTimePoint(fromAgo(PRESENT_EPOCH - year, 'ka'), locale)
    : formatTimePoint(fromYear(Math.round(year), 'year'), locale)
}

export function buildScene(input: BuildSceneInput): TimelineScene {
  const { events, view, overview, nowYear, width, selectedId } = input
  const hoveredId = input.hoveredId ?? null
  const locale = input.locale ?? 'zh'
  const axis = input.axis ?? linearAxis()
  const categoryColors = input.categoryColors ?? new Map<Id, string>()
  const scale = input.scale ?? 1
  const fontSizePx = BASE_FONT_PX * scale
  const xOf = (year: number) => projectLinear(axis.toU(year), view) * width

  // The present gets a chip in the tick row; tick labels under it give way.
  const nowX = xOf(nowYear)
  const nowInView = nowX >= 0 && nowX <= width
  const nowLabel = formatAgeLabel(0, locale)
  const chip = nowInView ? nowChipSpan(nowX, nowLabel, fontSizePx, width) : null

  // Ticks are thinned by the width of their actual labels, so they never
  // collide — at any magnification and in either language.
  const ticks: SceneTick[] = []
  let lastRight = -Infinity
  for (const tick of axis.ticks(view, Math.max(2, Math.floor(width / 100)), locale)) {
    const x = projectLinear(tick.u, view) * width
    if (x < 0 || x > width) continue
    const w = labelWidth(tick.label, fontSizePx)
    if (x < lastRight + TICK_GAP) continue
    // a label that would run off the right edge, or under the now chip, keeps
    // its line and loses its text
    const underChip = chip !== null && x + TICK_PAD < chip.x1 + 4 && x + TICK_PAD + w > chip.x0 - 4
    ticks.push({ x, label: x + TICK_PAD + w <= width && !underChip ? tick.label : '' })
    lastRight = x + TICK_PAD + w
  }

  type Raw = Omit<SceneGlyph, 'row'> & { left: number; right: number; tStart: number; tEnd: number; lane: string }
  const raws: Raw[] = []
  for (const e of events) {
    if (!e.start && !e.end) continue
    let kind: 'point' | 'span'
    let xStart: number
    let xEnd: number
    let tStart: number
    let tEnd: number
    const whiskers: { lo: number; hi: number }[] = []
    const addWhisker = (tp: NonNullable<EventRecord['start']>) => {
      const r = fuzzRangeOf(tp)
      if (r.latest > r.earliest) whiskers.push({ lo: xOf(r.earliest), hi: xOf(r.latest) })
    }
    if (e.start && e.end) {
      kind = 'span'
      const si = instantOf(e.start)
      const ei = instantOf(e.end)
      // ordering uses core instants; normalize so tStart <= tEnd even if a
      // record happens to store end before start
      tStart = Math.min(si, ei)
      tEnd = Math.max(si, ei)
      xStart = xOf(si)
      xEnd = xOf(ei)
      addWhisker(e.start)
      addWhisker(e.end)
    } else {
      kind = 'point'
      const tp = (e.start ?? e.end)!
      tStart = tEnd = instantOf(tp)
      xStart = xEnd = xOf(tStart)
      addWhisker(tp)
    }
    const wlo = whiskers.length ? Math.min(...whiskers.map((w) => w.lo)) : xStart
    const whi = whiskers.length ? Math.max(...whiskers.map((w) => w.hi)) : xEnd
    const left = Math.min(xStart, wlo)
    const right = Math.max(xEnd, whi)
    if (right < 0 || left > width) continue
    const color = e.categoryId != null ? categoryColors.get(e.categoryId) : undefined
    const placed = placeLabel({ coreLeft: left, coreRight: right, text: e.title, fontSizePx, canvasWidth: width })
    raws.push({
      eventId: e.id,
      kind,
      xStart,
      xEnd,
      whiskers,
      selected: e.id === selectedId,
      hovered: e.id === hoveredId,
      color,
      label: { text: placed.text, side: placed.side, x: placed.x, width: placed.text ? labelWidth(placed.text, fontSizePx) : 0 },
      left: placed.occLeft,
      right: placed.occRight,
      tStart,
      tEnd,
      lane: input.lanes ? input.lanes.keyOf(e) : '',
    })
  }

  const strip = (p: Raw & { row: number }, row: number): SceneGlyph => ({
    eventId: p.eventId,
    kind: p.kind,
    xStart: p.xStart,
    xEnd: p.xEnd,
    whiskers: p.whiskers,
    row,
    selected: p.selected,
    hovered: p.hovered,
    color: p.color,
    label: p.label,
  })

  const glyphs: SceneGlyph[] = []
  const lanes: SceneLane[] = []
  let rowCount = 0
  if (input.lanes) {
    const byLane = new Map<string, Raw[]>()
    for (const r of raws) {
      const arr = byLane.get(r.lane)
      if (arr) arr.push(r)
      else byLane.set(r.lane, [r])
    }
    for (const def of input.lanes.defs) {
      const items = byLane.get(def.key)
      if (!items?.length) continue
      const packed = packRows(items)
      const laneRows = packed.reduce((m, p) => Math.max(m, p.row + 1), 0)
      lanes.push({ key: def.key, label: def.label, color: def.color, row: rowCount, rows: laneRows + 1 })
      for (const p of packed) glyphs.push(strip(p, rowCount + 1 + p.row))
      rowCount += laneRows + 1
    }
  } else {
    for (const p of packRows(raws)) glyphs.push(strip(p, p.row))
    rowCount = glyphs.reduce((m, g) => Math.max(m, g.row + 1), 0)
  }

  // the selected event's links, drawn as connectors to whichever are on screen
  const links: SceneLink[] = []
  const sel = selectedId != null ? glyphs.find((g) => g.eventId === selectedId) : undefined
  if (sel) {
    const linked = events.find((e) => e.id === selectedId)?.links ?? []
    const centre = (g: SceneGlyph) => (g.kind === 'span' ? (g.xStart + g.xEnd) / 2 : g.xStart)
    for (const id of linked) {
      const g = glyphs.find((x) => x.eventId === id)
      if (g) links.push({ x0: centre(sel), row0: sel.row, x1: centre(g), row1: g.row })
    }
  }

  const rawMarkers: { x: number; eventId: Id }[] = []
  for (const e of events) {
    const inst = eventInstant(e)
    if (inst === null) continue
    const f = projectLinear(axis.toU(inst), overview)
    if (f < 0 || f > 1) continue // event lies outside the overview's current extent
    rawMarkers.push({ x: f * width, eventId: e.id })
  }
  const markers = aggregateMarkers(rawMarkers, MARKER_BUCKET_PX)

  // Lens = the detail view projected onto the (linear-in-u) overview. Clamp it
  // into the band, keep a minimum visible width, then shift it fully inside.
  const lens = lensFromView(view, overview)
  const lx0 = Math.min(Math.max(lens.f0, 0), 1) * width
  const lx1 = Math.min(Math.max(lens.f1, 0), 1) * width
  const lensW = Math.min(Math.max(lx1 - lx0, MIN_LENS_PX), width)
  const x0 = Math.max(0, Math.min(lx0, width - lensW))
  const x1 = x0 + lensW
  const range = {
    start: rangeLabel(axis.fromU(overview.min), nowYear, locale, axis),
    end: rangeLabel(axis.fromU(overview.max), nowYear, locale, axis),
  }

  const nowO = projectLinear(axis.toU(nowYear), overview)
  return {
    width,
    detail: {
      ticks,
      glyphs,
      rowCount,
      lanes,
      links,
      now: nowInView ? nowX : null,
      nowLabel,
    },
    overview: { markers, lens: { x0, x1 }, range, now: nowO >= 0 && nowO <= 1 ? nowO * width : null },
  }
}

/** Which glyph, if any, is under a point of the detail band. Uses the scaled
 *  layout — glyph, whiskers and label — so a larger display size is not
 *  harder to hit, and the title is a target too. */
export function hitTest(
  scene: TimelineScene,
  layout: { glyphTop: number; rowHeight: number; barHeight: number; dotRadius: number },
  x: number,
  y: number,
  scrollY: number,
): SceneGlyph | null {
  const slop = 4
  for (const g of scene.detail.glyphs) {
    const top = layout.glyphTop + g.row * layout.rowHeight - scrollY
    const bottom = top + Math.max(layout.barHeight, layout.dotRadius * 2)
    if (y < top - slop || y > bottom + slop) continue
    const coreL = Math.min(g.xStart, g.xEnd) - (g.kind === 'point' ? layout.dotRadius : 0)
    const coreR = Math.max(g.xStart, g.xEnd) + (g.kind === 'point' ? layout.dotRadius : 0)
    if (x >= coreL - slop && x <= coreR + slop) return g
    if (g.label.side === 'right' && x >= g.label.x && x <= g.label.x + g.label.width) return g
    if (g.label.side === 'left' && x <= g.label.x && x >= g.label.x - g.label.width) return g
  }
  return null
}
