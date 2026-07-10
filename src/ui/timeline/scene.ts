import type { EventRecord, Id } from '../../domain/model'
import {
  type LinearView,
  projectLinear,
  generateTicks,
  fuzzRangeOf,
  instantOf,
  formatTimePoint,
  fromYear,
  fromAgo,
  PRESENT_EPOCH,
} from '../../domain/time'
import type { Locale } from '../../domain/locale'
import { packRows } from './packing'
import { lensFromView } from './view'
import { placeLabel, BASE_FONT_PX } from './labels'

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
  color?: string
  label: { text: string; side: 'left' | 'right' | 'none'; x: number }
}

export interface SceneMarker {
  x: number
  count: number
  eventId?: Id
}

export interface TimelineScene {
  width: number
  detail: { ticks: SceneTick[]; glyphs: SceneGlyph[]; rowCount: number }
  overview: {
    markers: SceneMarker[]
    lens: { x0: number; x1: number }
    range: { start: string; end: string }
  }
}

export interface BuildSceneInput {
  events: EventRecord[]
  view: LinearView
  // The overview band's currently shown extent (linear). The lens and the event
  // markers are projected onto this, so the user can zoom/pan it to spread out a
  // crowded era without changing the detail view.
  overview: LinearView
  nowYear: number
  width: number
  selectedId: Id | null
  // live category id → color; a glyph's color is its event's category color
  // (undefined when the event is uncategorized or the category is missing).
  categoryColors?: Map<Id, string>
  // display magnification (1 = normal). Widens labels so packing reserves the
  // scaled width; the renderer scales the matching pixel sizes.
  scale?: number
  locale?: Locale
}

const MARKER_BUCKET_PX = 6
const MIN_LENS_PX = 2 // keep the lens visible even when it degenerates at a band edge

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
// the present, a relative "约X…年前/后" deeper in time (the formatter picks the
// 亿/万/年 unit automatically for relative precisions).
function rangeLabel(year: number, nowYear: number, locale: Locale): string {
  return Math.abs(nowYear - year) >= 1000
    ? formatTimePoint(fromAgo(PRESENT_EPOCH - year, 'ka'), locale)
    : formatTimePoint(fromYear(year, 'year'), locale)
}

export function buildScene(input: BuildSceneInput): TimelineScene {
  const { events, view, overview, nowYear, width, selectedId } = input
  const locale = input.locale ?? 'zh'
  const categoryColors = input.categoryColors ?? new Map<Id, string>()
  const scale = input.scale ?? 1
  const fontSizePx = BASE_FONT_PX * scale
  const xOf = (year: number) => projectLinear(year, view) * width

  // Thin ticks to a minimum pixel gap so their (left-aligned) labels never
  // collide — deep-time labels like "约140.0亿年前" are ~70px wide, so at narrow
  // widths a full set of ticks would overlap into an unreadable smear.
  const MIN_TICK_GAP = 80
  const ticks: SceneTick[] = []
  let lastTickX = -Infinity
  for (const tp of generateTicks(view)) {
    const x = xOf(instantOf(tp))
    if (x < 0 || x > width) continue
    if (x - lastTickX < MIN_TICK_GAP) continue
    ticks.push({ x, label: formatTimePoint(tp, locale) })
    lastTickX = x
  }

  type Raw = Omit<SceneGlyph, 'row'> & { left: number; right: number; tStart: number; tEnd: number }
  const raws: Raw[] = []
  for (const e of events) {
    if (!e.start && !e.end) continue
    let kind: 'point' | 'span'
    let xStart: number
    let xEnd: number
    let tStart: number
    let tEnd: number
    let whiskers: { lo: number; hi: number }[]
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
      whiskers = []
      const rs = fuzzRangeOf(e.start)
      if (rs.latest > rs.earliest) whiskers.push({ lo: xOf(rs.earliest), hi: xOf(rs.latest) })
      const re = fuzzRangeOf(e.end)
      if (re.latest > re.earliest) whiskers.push({ lo: xOf(re.earliest), hi: xOf(re.latest) })
    } else {
      kind = 'point'
      const tp = (e.start ?? e.end)!
      const inst = instantOf(tp)
      tStart = inst
      tEnd = inst
      xStart = xOf(inst)
      xEnd = xStart
      whiskers = []
      const r = fuzzRangeOf(tp)
      if (r.latest > r.earliest) whiskers.push({ lo: xOf(r.earliest), hi: xOf(r.latest) })
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
      color,
      label: { text: placed.text, side: placed.side, x: placed.x },
      left: placed.occLeft,
      right: placed.occRight,
      tStart,
      tEnd,
    })
  }

  const packed = packRows(raws)
  const glyphs: SceneGlyph[] = packed.map((p) => ({
    eventId: p.eventId,
    kind: p.kind,
    xStart: p.xStart,
    xEnd: p.xEnd,
    whiskers: p.whiskers,
    row: p.row,
    selected: p.selected,
    color: p.color,
    label: p.label,
  }))
  const rowCount = glyphs.reduce((m, g) => Math.max(m, g.row + 1), 0)

  const rawMarkers: { x: number; eventId: Id }[] = []
  for (const e of events) {
    const inst = eventInstant(e)
    if (inst === null) continue
    const f = projectLinear(inst, overview)
    if (f < 0 || f > 1) continue // event lies outside the overview's current extent
    rawMarkers.push({ x: f * width, eventId: e.id })
  }
  const markers = aggregateMarkers(rawMarkers, MARKER_BUCKET_PX)

  // Lens = the detail view projected onto the (linear) overview. Clamp it into
  // the band, keep a minimum visible width, then shift it fully inside — so it
  // never spills past an edge when the view sits outside the overview's current
  // (zoomed) extent.
  const lens = lensFromView(view, overview)
  const lx0 = Math.min(Math.max(lens.f0, 0), 1) * width
  const lx1 = Math.min(Math.max(lens.f1, 0), 1) * width
  const lensW = Math.min(Math.max(lx1 - lx0, MIN_LENS_PX), width)
  const x0 = Math.max(0, Math.min(lx0, width - lensW))
  const x1 = x0 + lensW
  const range = { start: rangeLabel(overview.min, nowYear, locale), end: rangeLabel(overview.max, nowYear, locale) }
  return {
    width,
    detail: { ticks, glyphs, rowCount },
    overview: { markers, lens: { x0, x1 }, range },
  }
}
