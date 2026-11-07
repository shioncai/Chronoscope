import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, useAppSelector, useVisibleEvents, shallowEqual, freeTitle } from '../../state'
import {
  axisFor,
  fuzzRangeOf,
  formatDuration,
  type AxisKind,
  type LinearView,
  type TimeAxis,
} from '../../domain/time'
import type { Category, EventRecord, Id } from '../../domain/model'
import { fitRange, zoomView, panView, clampView, viewFromLensCenter, panViewByLensDrag, clampScroll } from './view'
import { spreadOf, pinchScale, midpointOf, type Finger } from './gesture'
import { buildScene, hitTest, rangeLabel, type LaneDef, type TimelineScene, type BuildSceneInput } from './scene'
import { drawScene, computeLayout, OVERVIEW_HEIGHT, type TimelineColors } from './renderer'
import { buildEventCard, formatEventTime } from './card'
import { EventDetailCard } from './EventDetailCard'
import { TimelineToolbar } from './TimelineToolbar'
import { EmptyState } from '../app/EmptyState'
import { useEmptyKind } from '../app/useEmptyKind'
import { todayStamp } from '../app/useDataTransfer'
import { useKeys } from '../app/useShortcuts'
import { useToast } from '../components/useToast'
import { saveFile } from '../../platform'
import { useT, useTn, useLocale } from '../../i18n/useT'

export interface TimelineViewProps {
  onEdit: (id: Id) => void
  onNew?: () => void
}

// The renderer reads the theme by custom-property NAME — renaming a token in
// tokens.css silently blanks the canvas unless it is renamed here too.
function readColors(el: Element): TimelineColors {
  const s = getComputedStyle(el)
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
  return {
    bg: v('--bg', '#fff'),
    surface: v('--surface', '#f0f0f0'),
    text: v('--text', '#000'),
    muted: v('--muted', '#888'),
    border: v('--border', '#ccc'),
    floatBorder: v('--float-border', '#ccc'),
    accent: v('--accent', '#0aa'),
    deepTime: v('--deep-time', '#b4541f'),
  }
}

const clampScale = (s: number) => Math.min(2.5, Math.max(1, Math.round(s * 4) / 4))

/** One lane per top-level folder, in tree order, plus one for the rest. */
function laneDefs(categories: Category[], uncategorized: string): { defs: LaneDef[]; keyOf: (e: EventRecord) => string } {
  const live = categories.filter((c) => !c.deleted)
  const byId = new Map(live.map((c) => [c.id, c]))
  const top = new Map<Id, Id>()
  const topOf = (id: Id): Id => {
    const hit = top.get(id)
    if (hit) return hit
    const seen = new Set<Id>()
    let cur = byId.get(id)
    while (cur && cur.parentId != null && byId.has(cur.parentId) && !seen.has(cur.id)) {
      seen.add(cur.id)
      cur = byId.get(cur.parentId)
    }
    const result = cur?.id ?? ''
    top.set(id, result)
    return result
  }
  const defs: LaneDef[] = live
    .filter((c) => c.parentId == null || !byId.has(c.parentId))
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ key: c.id, label: c.name, color: c.color }))
  defs.push({ key: '', label: uncategorized })
  return { defs, keyOf: (e) => (e.categoryId != null && byId.has(e.categoryId) ? topOf(e.categoryId) : '') }
}

/** Every position an event occupies on the axis, fuzz included. */
function eventUs(events: EventRecord[], axis: TimeAxis): number[] {
  const us: number[] = []
  for (const e of events) {
    for (const tp of [e.start, e.end]) {
      if (!tp) continue
      const r = fuzzRangeOf(tp)
      us.push(axis.toU(r.earliest), axis.toU(r.latest))
    }
  }
  return us
}

const fitFor = (events: EventRecord[], axis: TimeAxis, nowYear: number): LinearView => {
  const us = eventUs(events, axis)
  if (axis.kind === 'log') {
    if (us.length) us.push(0) // the log axis is measured from now; keep it in view
    return fitRange(us, { min: axis.toU(nowYear - 1000), max: 0.5 }, 0.5, 0.03)
  }
  return fitRange(us, { min: nowYear - 100, max: nowYear + 10 }, 50)
}

export function TimelineView({ onEdit, onNew }: TimelineViewProps) {
  const app = useAppStore()
  const t = useT()
  const tn = useTn()
  const locale = useLocale()
  const toast = useToast()
  const events = useVisibleEvents()
  const emptyKind = useEmptyKind()
  const st = useAppSelector(
    (s) => ({
      nowYear: s.nowYear,
      scale: s.timelineScale,
      axisKind: s.timelineAxis,
      lanesOn: s.timelineLanes,
      selectedId: s.selectedId,
      theme: s.theme,
      categories: s.categories,
      tags: s.tags,
      allEvents: s.events,
      storedView: s.timelineView,
      storedOverview: s.timelineOverview,
      reveal: s.reveal,
    }),
    shallowEqual,
  )
  const { nowYear, scale } = st
  const axis = useMemo(() => axisFor(st.axisKind, nowYear), [st.axisKind, nowYear])

  const categoryColors = useMemo(() => {
    const m = new Map<Id, string>()
    for (const c of st.categories) if (!c.deleted) m.set(c.id, c.color)
    return m
  }, [st.categories])
  const uncategorized = t('common.uncategorized')
  const lanes = useMemo(
    () => (st.lanesOn ? laneDefs(st.categories, uncategorized) : undefined),
    [st.lanesOn, st.categories, uncategorized],
  )

  // `fit` frames the data; `nav` is how far a pan may go — the data plus the
  // present, so "now" is always reachable even for a purely ancient timeline.
  const fit = useMemo(() => fitFor(events, axis, nowYear), [events, axis, nowYear])
  const nav = useMemo<LinearView>(() => {
    const nowU = axis.toU(nowYear)
    const pad = (fit.max - fit.min) * 0.05
    return { min: Math.min(fit.min, nowU - pad), max: Math.max(fit.max, nowU + pad) }
  }, [fit, axis, nowYear])

  const view = st.storedView ?? fit
  const overview = st.storedOverview ?? fit

  // the latest geometry, for handlers and store updaters that outlive a render
  const geo = useRef({ fit, nav, axis, view, overview })
  useEffect(() => {
    geo.current = { fit, nav, axis, view, overview }
  })
  const clampToNav = (v: LinearView) => clampView(v, geo.current.nav.min, geo.current.nav.max, geo.current.axis.minSpan)
  const setView = (u: LinearView | ((v: LinearView) => LinearView)) =>
    app.setTimelineView((prev) => clampToNav(typeof u === 'function' ? u(prev ?? geo.current.fit) : u))
  const setOverview = (u: LinearView | ((o: LinearView) => LinearView)) =>
    app.setTimelineOverview((prev) => clampToNav(typeof u === 'function' ? u(prev ?? geo.current.fit) : u))

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<TimelineScene | null>(null)
  const layoutRef = useRef(computeLayout(0))
  const backing = useRef({ w: 0, h: 0, dpr: 0 })
  const colorsRef = useRef<{ theme: string; colors: TimelineColors } | null>(null)
  const pendingRow = useRef<Id | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  // Vertical scroll of the detail band, in px. Local (transient position).
  const [scrollY, setScrollY] = useState(0)
  const [hover, setHover] = useState<{ id: Id; x: number; y: number } | null>(null)

  // track element size
  const hasEvents = events.length > 0
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    if (typeof ResizeObserver === 'undefined') return // jsdom has no ResizeObserver
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasEvents])

  const sceneInput = (width: number): BuildSceneInput => ({
    events,
    view,
    overview,
    nowYear,
    width,
    selectedId: st.selectedId,
    hoveredId: hover?.id ?? null,
    categoryColors,
    scale,
    locale,
    axis,
    lanes,
  })

  // build + draw whenever inputs change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0 || size.h === 0) return
    const dpr = window.devicePixelRatio || 1
    // Resizing the backing store clears and reallocates it, so only do it when
    // the size actually changed — not on every frame of a pan.
    if (backing.current.w !== size.w || backing.current.h !== size.h || backing.current.dpr !== dpr) {
      canvas.width = Math.round(size.w * dpr)
      canvas.height = Math.round(size.h * dpr)
      backing.current = { w: size.w, h: size.h, dpr }
    }
    const scene = buildScene(sceneInput(size.w))
    const layout = computeLayout(size.h, scale)
    sceneRef.current = scene
    layoutRef.current = layout
    const contentH = scene.detail.rowCount * layout.rowHeight
    const visibleH = layout.overviewTop - layout.glyphTop
    let sy = clampScroll(scrollY, contentH, visibleH)
    if (pendingRow.current) {
      const g = scene.detail.glyphs.find((x) => x.eventId === pendingRow.current)
      pendingRow.current = null
      if (g) {
        const rowTop = g.row * layout.rowHeight
        if (rowTop < sy || rowTop > sy + visibleH - layout.rowHeight) {
          sy = clampScroll(rowTop - visibleH / 2, contentH, visibleH)
          setScrollY(sy)
        }
      }
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return // jsdom / unsupported: scene is still computed, just not painted
    if (colorsRef.current?.theme !== st.theme) colorsRef.current = { theme: st.theme, colors: readColors(canvas) }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawScene(ctx, scene, colorsRef.current.colors, layout, sy)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sceneInput reads exactly the listed values
  }, [events, view, overview, nowYear, size, st.selectedId, hover?.id, st.theme, categoryColors, scale, scrollY, locale, axis, lanes])

  // re-clamp the scroll offset when magnification / size / content shrink the
  // scrollable range, so it never rests past the end
  useEffect(() => {
    const layout = layoutRef.current
    const rows = sceneRef.current?.detail.rowCount ?? 0
    setScrollY((y) => clampScroll(y, rows * layout.rowHeight, layout.overviewTop - layout.glyphTop))
  }, [scale, size, events, lanes])

  // "Show on timeline": centre the event (zooming out if it is wider than the
  // window), then scroll its row into view once the scene has placed it.
  useEffect(() => {
    if (!st.reveal) return
    const id = st.reveal
    app.clearReveal()
    const e = events.find((x) => x.id === id)
    if (!e) return
    const us = eventUs([e], axis)
    const lo = Math.min(...us)
    const hi = Math.max(...us)
    const cur = geo.current.view
    const span = cur.max - cur.min
    const margin = span * 0.08
    if (hi - lo > span * 0.84) {
      const pad = (hi - lo) * 0.2
      setView({ min: lo - pad, max: hi + pad })
    } else if (lo < cur.min + margin || hi > cur.max - margin) {
      const c = (lo + hi) / 2
      setView({ min: c - span / 2, max: c + span / 2 })
    }
    pendingRow.current = id
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per request
  }, [st.reveal])

  // pointer interactions
  const drag = useRef<{ x: number; y: number; mode: 'pan' | 'lens' | 'overviewPan'; moved: boolean } | null>(null)
  // every finger currently on the glass, by pointer id. Kept live on each move:
  // the pinch math reads it, and a finger still on record at its landing point
  // would make the next finger's arrival measure the opening spread against a
  // stale coordinate.
  const pointers = useRef(new Map<number, Finger>())

  const fractionAt = (clientX: number): number => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  }

  // detail-band scroll geometry from the latest built scene + layout
  const scrollMetrics = () => {
    const layout = layoutRef.current
    const rows = sceneRef.current?.detail.rowCount ?? 0
    return { contentH: rows * layout.rowHeight, visibleH: layout.overviewTop - layout.glyphTop }
  }
  const scrollBy = (dy: number) => {
    const { contentH, visibleH } = scrollMetrics()
    setScrollY((y) => clampScroll(y + dy, contentH, visibleH))
  }
  const zoomAt = (frac: number, factor: number) => setView((v) => zoomView(v, frac, factor, geo.current.axis.minSpan))

  // Native (non-passive) wheel listener: React attaches `wheel` at the root as a
  // passive listener, so a React onWheel can't preventDefault(). We attach our
  // own {passive:false} listener via a ref so the latest closure is always used.
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    const localY = rect ? e.clientY - rect.top : 0
    const width = rect?.width || 1
    const frac = fractionAt(e.clientX)
    // Shift+wheel or a horizontal scroll pans; Ctrl/⌘+wheel scrolls the rows; a
    // plain wheel zooms at the cursor.
    const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)
    const amount = e.deltaX !== 0 ? e.deltaX : e.deltaY
    // trackpads send many small deltas, a mouse wheel few large ones: scale the
    // zoom by the delta so both feel the same
    const factor = Math.exp(Math.max(-1, Math.min(1, e.deltaY / 300)) * 0.5)
    if (localY >= layoutRef.current.overviewTop) {
      // wheel over the overview navigates the OVERVIEW band itself (its extent)
      if (horizontal) setOverview((o) => panView(o, amount / width))
      else setOverview((o) => zoomView(o, frac, factor, geo.current.axis.minSpan))
      return
    }
    if (e.ctrlKey || e.metaKey) {
      scrollBy(e.deltaY)
      return
    }
    if (horizontal) setView((v) => panView(v, amount / width))
    else zoomAt(frac, factor)
  }
  const wheelRef = useRef(handleWheel)
  useEffect(() => {
    wheelRef.current = handleWheel // keep the latest closure without re-attaching
  })
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const listener = (e: WheelEvent) => wheelRef.current(e)
    canvas.addEventListener('wheel', listener, { passive: false })
    return () => canvas.removeEventListener('wheel', listener)
  }, [hasEvents])

  const onDoubleClick = (e: React.MouseEvent) => {
    // zoom-to-fit / reset: the overview band resets its own extent; the detail
    // area resets the detail view. Both go back to the full data range.
    const rect = canvasRef.current?.getBoundingClientRect()
    const localY = rect ? e.clientY - rect.top : 0
    if (localY >= layoutRef.current.overviewTop) app.setTimelineOverview(null)
    else app.setTimelineView(null)
  }

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return { x: rect ? e.clientX - rect.left : 0, y: rect ? e.clientY - rect.top : 0, w: rect?.width || 1 }
  }
  const glyphAt = (x: number, y: number) => {
    const scene = sceneRef.current
    if (!scene || y >= layoutRef.current.overviewTop || y < layoutRef.current.tickLabelH) return null
    const { contentH, visibleH } = scrollMetrics()
    return hitTest(scene, layoutRef.current, x, y, clampScroll(scrollY, contentH, visibleH))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    wrapRef.current?.focus({ preventScroll: true })
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setHover(null)
    if (pointers.current.size >= 2) {
      drag.current = null // a pinch began; stop panning/lens-dragging
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      return
    }
    const { x, y } = localPoint(e)
    let mode: 'pan' | 'lens' | 'overviewPan' = 'pan'
    if (y >= layoutRef.current.overviewTop) {
      // inside the overview: grabbing the lens pans the view; grabbing empty
      // overview space pans the overview band's own extent.
      const lens = sceneRef.current?.overview.lens
      mode = lens && x >= lens.x0 - 6 && x <= lens.x1 + 6 ? 'lens' : 'overviewPan'
    }
    drag.current = { x: e.clientX, y: e.clientY, mode, moved: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.size >= 2) {
      const prev = [...pointers.current.values()]
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const next = [...pointers.current.values()]
      const rect = canvasRef.current?.getBoundingClientRect()
      const width = rect?.width || 1
      const left = rect?.left ?? 0
      // Scale by how much further apart the fingers actually are — their real
      // distance, not its shadow on the time axis (see spreadOf). And a pinch is
      // a scale AND a translation: zoom about where the midpoint WAS, then slide
      // by however far it travelled, so whatever sat under the hand stays there.
      const pinch = pinchScale(spreadOf(prev), spreadOf(next))
      const m0 = midpointOf(prev)
      const m1 = midpointOf(next)
      const f0 = (m0.x - left) / width
      const f1 = (m1.x - left) / width
      setView((v) => panView(zoomView(v, f0, 1 / pinch, geo.current.axis.minSpan), f0 - f1))
      if (m1.y !== m0.y) scrollBy(-(m1.y - m0.y))
      return
    }
    const d = drag.current
    if (!d) {
      // plain hover (mouse only — a touch has no hover)
      if (e.pointerType !== 'mouse') return
      const { x, y } = localPoint(e)
      const g = glyphAt(x, y)
      if (!g) {
        if (hover) setHover(null)
        return
      }
      if (hover?.id === g.eventId) return
      const layout = layoutRef.current
      const { contentH, visibleH } = scrollMetrics()
      const gy = layout.glyphTop + g.row * layout.rowHeight - clampScroll(scrollY, contentH, visibleH)
      setHover({ id: g.eventId, x: Math.min(Math.max(g.kind === 'span' ? x : g.xStart, 8), size.w - 8), y: gy })
      return
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const width = localPoint(e).w
    const dxFrac = (e.clientX - d.x) / width
    const dyPx = e.clientY - d.y
    if (Math.abs(e.clientX - d.x) > 3 || Math.abs(dyPx) > 3) d.moved = true
    d.x = e.clientX
    d.y = e.clientY
    if (d.mode === 'pan') {
      // horizontal pans the time axis; vertical scrolls the (possibly overflowing) rows
      if (dyPx !== 0) scrollBy(-dyPx)
      setView((v) => panView(v, -dxFrac))
    } else if (d.mode === 'overviewPan') {
      setOverview((o) => panView(o, -dxFrac))
    } else {
      // dragging the overview lens PANS the detail window (keeps zoom).
      setView((v) => panViewByLensDrag(v, dxFrac, geo.current.overview))
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    const d = drag.current
    drag.current = null
    // A pinch that loses a finger becomes a one-finger pan, re-armed from where
    // the survivor actually is. `moved` starts true: this is the tail of a drag.
    if (pointers.current.size === 1) {
      const survivor = [...pointers.current.values()][0]
      drag.current = { x: survivor.x, y: survivor.y, mode: 'pan', moved: true }
      return
    }
    if (!d || d.moved) return
    const { x, y, w } = localPoint(e)
    if (y >= layoutRef.current.overviewTop) {
      // click on the overview → jump: centre the detail window there (keeps zoom)
      const centerFrac = Math.min(Math.max(x / w, 0), 1)
      setView((v) => viewFromLensCenter(v, centerFrac, geo.current.overview))
      return
    }
    const g = glyphAt(x, y)
    app.select(g ? g.eventId : null) // empty detail space dismisses the card
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    drag.current = null
  }

  // Resolve against the same `events` the scene rendered, so a selected glyph in
  // the recycle bin still surfaces its card.
  const selectedEvent = st.selectedId != null ? events.find((e) => e.id === st.selectedId) ?? null : null
  const hoverEvent = hover && hover.id !== st.selectedId ? events.find((e) => e.id === hover.id) : undefined

  const undoToast = (message: string) => toast({ message, action: { label: t('common.undo'), run: () => void app.undo() } })
  const actions = {
    fit: () => app.setTimelineView(null),
    now: () => {
      const c = axis.toU(nowYear)
      setView((v) => ({ min: c - (v.max - v.min) / 2, max: c + (v.max - v.min) / 2 }))
    },
    axis: (k: AxisKind) => app.setTimelineAxis(k),
    lanes: (on: boolean) => app.setTimelineLanes(on),
    remove: async (e: EventRecord) => {
      await app.deleteEvent(e.id)
      undoToast(tn('toast.deleted', 1))
    },
    duplicate: async (e: EventRecord) => {
      const id = await app.duplicateEvent(e.id, freeTitle(st.allEvents, e.title, e.categoryId))
      app.select(id)
      undoToast(t('toast.duplicated'))
    },
    restore: async (e: EventRecord) => {
      const { conflicts } = await app.restoreEvents([e.id])
      if (conflicts.length) onEdit(e.id)
      else undoToast(tn('toast.restored', 1))
    },
    exportImage: async () => {
      const canvas = canvasRef.current
      if (!canvas || size.w === 0) return
      const scene = buildScene({ ...sceneInput(size.w), hoveredId: null })
      const base = computeLayout(0, scale)
      const height = Math.max(240, Math.ceil(base.glyphTop + scene.detail.rowCount * base.rowHeight + 24 + OVERVIEW_HEIGHT))
      const out = document.createElement('canvas')
      const dpr = 2
      out.width = size.w * dpr
      out.height = height * dpr
      const ctx = out.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawScene(ctx, scene, readColors(canvas), computeLayout(height, scale), 0)
      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'))
      if (!blob) return
      const name = `chronoscope-${todayStamp()}.png`
      if (await saveFile(name, blob, 'image/png')) toast({ message: t('toast.exported', { name }) })
    },
  }

  useKeys({
    ArrowLeft: () => setView((v) => panView(v, -0.15)),
    ArrowRight: () => setView((v) => panView(v, 0.15)),
    'shift+ArrowLeft': () => setView((v) => panView(v, -0.5)),
    'shift+ArrowRight': () => setView((v) => panView(v, 0.5)),
    ArrowUp: () => scrollBy(-layoutRef.current.rowHeight * 3),
    ArrowDown: () => scrollBy(layoutRef.current.rowHeight * 3),
    '+': () => zoomAt(0.5, 0.7),
    '=': () => zoomAt(0.5, 0.7),
    '-': () => zoomAt(0.5, 1 / 0.7),
    _: () => zoomAt(0.5, 1 / 0.7),
    '0': actions.fit,
    t: actions.now,
    l: () => actions.axis(st.axisKind === 'log' ? 'linear' : 'log'),
    g: () => actions.lanes(!st.lanesOn),
    Enter: () => selectedEvent && onEdit(selectedEvent.id),
    Escape: () => st.selectedId && app.select(null),
    Delete: () => selectedEvent && !selectedEvent.deleted && void actions.remove(selectedEvent),
    Backspace: () => selectedEvent && !selectedEvent.deleted && void actions.remove(selectedEvent),
  })

  // A width in years means little on a log axis (it is dominated by the deep
  // end), so there the readout names the two edges instead.
  const spanText = axis.kind === 'log'
    ? t('timeline.range', { a: rangeLabel(axis.fromU(view.min), nowYear, locale, axis), b: rangeLabel(axis.fromU(view.max), nowYear, locale, axis) })
    : t('timeline.span', { d: formatDuration(axis.fromU(view.max) - axis.fromU(view.min), locale) })

  return (
    <div className="timeline-pane">
      <TimelineToolbar
        axis={st.axisKind}
        lanes={st.lanesOn}
        scale={scale}
        span={spanText}
        onZoom={(f) => zoomAt(0.5, f)}
        onFit={actions.fit}
        onNow={actions.now}
        onAxis={actions.axis}
        onLanes={actions.lanes}
        onScale={(d) => app.setTimelineScale((s) => clampScale(s + d))}
        onResetScale={() => app.setTimelineScale(1)}
        onExportImage={() => void actions.exportImage()}
      />
      {!hasEvents ? (
        <EmptyState kind={emptyKind} onNew={onNew ?? (() => {})} />
      ) : (
        <div ref={wrapRef} className="timeline-view" tabIndex={0} aria-label={tn('timeline.canvasLabel', events.length)}>
          <canvas
            ref={canvasRef}
            className={hover ? 'is-pointing' : undefined}
            onDoubleClick={onDoubleClick}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={() => hover && setHover(null)}
          />
          {hoverEvent && hover && (
            <div className="tl-tooltip" style={{ left: hover.x, top: hover.y }} role="tooltip">
              <strong>{hoverEvent.title}</strong>
              <span className="mono">{formatEventTime(hoverEvent, locale)}</span>
            </div>
          )}
          {selectedEvent && (
            <EventDetailCard
              data={buildEventCard(selectedEvent, { categories: st.categories, tags: st.tags, events: st.allEvents, nowYear }, locale)}
              onEdit={() => onEdit(selectedEvent.id)}
              onClose={() => app.select(null)}
              onSelectLink={(id) => app.revealEvent(id)}
              onDuplicate={() => void actions.duplicate(selectedEvent)}
              onDelete={() => void actions.remove(selectedEvent)}
              onRestore={() => void actions.restore(selectedEvent)}
            />
          )}
        </div>
      )}
    </div>
  )
}
