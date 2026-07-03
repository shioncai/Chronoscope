import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, useAppState, visibleEvents } from '../../state'
import { instantOf, type LinearView } from '../../domain/time'
import { initialView, zoomView, panView, clampView, viewFromLensCenter, panViewByLensDrag, clampScroll } from './view'
import { spanOf, pinchScale, midpoint } from './gesture'
import { buildScene, type TimelineScene } from './scene'
import { drawScene, computeLayout, type TimelineColors } from './renderer'
import type { Id } from '../../domain/model'
import { buildEventCard } from './card'
import { EventDetailCard } from './EventDetailCard'

export interface TimelineViewProps {
  onEdit: (id: Id) => void
}

function readColors(el: Element): TimelineColors {
  const s = getComputedStyle(el)
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
  return {
    bg: v('--bg', '#fff'),
    surface: v('--surface', '#f0f0f0'),
    text: v('--text', '#000'),
    muted: v('--muted', '#888'),
    border: v('--border', '#ccc'),
    accent: v('--accent', '#0aa'),
    now: v('--now', '#0cf'),
    deepTime: v('--deep-time', '#b4541f'),
  }
}

export function TimelineView({ onEdit }: TimelineViewProps) {
  const app = useAppStore()
  const state = useAppState()
  const events = useMemo(() => visibleEvents(state), [state])
  const nowYear = state.nowYear
  const scale = state.timelineScale
  const clampScale = (s: number) => Math.min(2.5, Math.max(1, Math.round(s * 4) / 4))

  const categoryColors = useMemo(() => {
    const m = new Map<Id, string>()
    for (const c of state.categories) if (!c.deleted) m.set(c.id, c.color)
    return m
  }, [state.categories])

  // Navigable range = padded extent of every event's start AND end instants.
  // The view is clamped to this, so the rightmost reachable edge is the latest
  // event (and the leftmost the earliest), with no empty space beyond the data.
  const bounds = useMemo<LinearView>(() => {
    const instants: number[] = []
    for (const e of events) {
      if (e.start) instants.push(instantOf(e.start))
      if (e.end) instants.push(instantOf(e.end))
    }
    return initialView(instants, nowYear)
  }, [events, nowYear])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<TimelineScene | null>(null)
  const layoutRef = useRef(computeLayout(0))
  const [size, setSize] = useState({ w: 0, h: 0 })
  // Vertical scroll of the detail band, in px. Local (transient position): resets
  // on a view switch; re-clamped when scale/size/content shrink the scroll range.
  const [scrollY, setScrollY] = useState(0)

  // The detail view and the overview band's extent live in the app store, not
  // local state, so the user's zoom/pan survives switching to the list view and
  // back (this component unmounts on a view switch). Until the user interacts
  // they fall back to `bounds`, so they still fit the data once events load.
  // `boundsRef` feeds that fallback into the store updaters.
  const boundsRef = useRef(bounds)
  boundsRef.current = bounds
  const view = state.timelineView ?? bounds
  const overview = state.timelineOverview ?? bounds
  const setView = (u: LinearView | ((v: LinearView) => LinearView)) =>
    app.setTimelineView((prev) => (typeof u === 'function' ? u(prev ?? boundsRef.current) : u))
  const setOverview = (u: LinearView | ((o: LinearView) => LinearView)) =>
    app.setTimelineOverview((prev) => (typeof u === 'function' ? u(prev ?? boundsRef.current) : u))

  // track element size
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    if (typeof ResizeObserver === 'undefined') return // jsdom has no ResizeObserver
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // build + draw whenever inputs change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0 || size.h === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    const scene = buildScene({ events, view, overview, nowYear, width: size.w, selectedId: state.selectedId, categoryColors, scale })
    const layout = computeLayout(size.h, scale)
    sceneRef.current = scene
    layoutRef.current = layout
    const ctx = canvas.getContext('2d')
    if (!ctx) return // jsdom / unsupported: scene is still computed, just not painted
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const contentH = scene.detail.rowCount * layout.rowHeight
    const visibleH = layout.overviewTop - layout.glyphTop
    drawScene(ctx, scene, readColors(canvas), layout, clampScroll(scrollY, contentH, visibleH))
  }, [events, view, overview, nowYear, size, state.selectedId, state.theme, categoryColors, scale, scrollY])

  // re-clamp the scroll offset when magnification / size / content shrink the
  // scrollable range, so it never rests past the end
  useEffect(() => {
    const layout = layoutRef.current
    const rows = sceneRef.current?.detail.rowCount ?? 0
    const contentH = rows * layout.rowHeight
    const visibleH = layout.overviewTop - layout.glyphTop
    setScrollY((y) => clampScroll(y, contentH, visibleH))
  }, [scale, size, events])

  // pointer interactions
  const drag = useRef<{ x: number; y: number; mode: 'pan' | 'lens' | 'overviewPan'; moved: boolean } | null>(null)
  // active pointers by id → clientX, for multi-touch pinch
  const pointers = useRef(new Map<number, number>())

  const fractionAt = (clientX: number): number => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  }

  // detail-band scroll geometry from the latest built scene + layout
  const scrollMetrics = () => {
    const layout = layoutRef.current
    const rows = sceneRef.current?.detail.rowCount ?? 0
    const contentH = rows * layout.rowHeight
    const visibleH = layout.overviewTop - layout.glyphTop
    return { contentH, visibleH }
  }

  // Native (non-passive) wheel listener: React attaches `wheel` at the root as a
  // passive listener, so a React onWheel can't preventDefault() — it warns and
  // lets the page scroll through the zoom. We attach our own {passive:false}
  // listener via a ref so the latest closure (bounds/view) is always used.
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    const localY = rect ? e.clientY - rect.top : 0
    const width = rect?.width || 1
    const frac = fractionAt(e.clientX)
    // Shift+wheel or a horizontal scroll pans; a plain wheel zooms at the cursor.
    const horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)
    const amount = e.deltaX !== 0 ? e.deltaX : e.deltaY
    const factor = e.deltaY < 0 ? 0.85 : 1.18
    if (localY >= layoutRef.current.overviewTop) {
      // wheel over the overview navigates the OVERVIEW band itself (its extent),
      // not the detail view — this is how you spread out / focus an era.
      if (horizontal) setOverview((o) => clampView(panView(o, amount / width), bounds.min, bounds.max))
      else setOverview((o) => clampView(zoomView(o, frac, factor), bounds.min, bounds.max))
      return
    }
    if (horizontal) {
      setView((v) => clampView(panView(v, amount / width), bounds.min, bounds.max))
      return
    }
    setView((v) => clampView(zoomView(v, frac, factor), bounds.min, bounds.max))
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
  }, [])

  const onDoubleClick = (e: React.MouseEvent) => {
    // zoom-to-fit / reset: the overview band resets its own extent; the detail
    // area resets the detail view. Both go back to the full data range.
    const rect = canvasRef.current?.getBoundingClientRect()
    const localY = rect ? e.clientY - rect.top : 0
    if (localY >= layoutRef.current.overviewTop) setOverview(bounds)
    else setView(bounds)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, e.clientX)
    if (pointers.current.size >= 2) {
      drag.current = null // a pinch began; stop panning/lens-dragging
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      return
    }
    const rect = canvasRef.current?.getBoundingClientRect()
    const localY = rect ? e.clientY - rect.top : 0
    const localX = rect ? e.clientX - rect.left : 0
    let mode: 'pan' | 'lens' | 'overviewPan' = 'pan'
    if (localY >= layoutRef.current.overviewTop) {
      // inside the overview: grabbing the lens pans the view; grabbing empty
      // overview space pans the overview band's own extent.
      const lens = sceneRef.current?.overview.lens
      mode = lens && localX >= lens.x0 - 6 && localX <= lens.x1 + 6 ? 'lens' : 'overviewPan'
    }
    drag.current = { x: e.clientX, y: e.clientY, mode, moved: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.size >= 2) {
      const prev = [...pointers.current.values()]
      pointers.current.set(e.pointerId, e.clientX)
      const next = [...pointers.current.values()]
      const pinch = pinchScale(spanOf(prev), spanOf(next))
      if (pinch !== 1) {
        const rect = canvasRef.current?.getBoundingClientRect()
        const width = rect?.width || 1
        const frac = Math.min(Math.max((midpoint(next) - (rect?.left ?? 0)) / width, 0), 1)
        // fingers apart (pinch > 1) → zoom in → factor < 1
        setView((v) => clampView(zoomView(v, frac, 1 / pinch), bounds.min, bounds.max))
      }
      return
    }
    const d = drag.current
    if (!d) return
    const rect = canvasRef.current?.getBoundingClientRect()
    const width = rect?.width || 1
    const dxFrac = (e.clientX - d.x) / width
    const dyPx = e.clientY - d.y
    if (Math.abs(e.clientX - d.x) > 3 || Math.abs(dyPx) > 3) d.moved = true
    d.x = e.clientX
    d.y = e.clientY
    if (d.mode === 'pan') {
      // horizontal pans the time axis; vertical scrolls the (possibly overflowing) rows
      if (dyPx !== 0) {
        const { contentH, visibleH } = scrollMetrics()
        setScrollY((yv) => clampScroll(yv - dyPx, contentH, visibleH))
      }
      setView((v) => clampView(panView(v, -dxFrac), bounds.min, bounds.max))
    } else if (d.mode === 'overviewPan') {
      setOverview((o) => clampView(panView(o, -dxFrac), bounds.min, bounds.max))
    } else {
      // dragging the overview lens PANS the detail window (keeps zoom). On the
      // linear overview this is a pure translation, so the lens width is fixed.
      setView((v) => clampView(panViewByLensDrag(v, dxFrac, overview), bounds.min, bounds.max))
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    const d = drag.current
    drag.current = null
    if (!d || d.moved) return
    // a click (no drag): hit-test detail glyphs
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const layout = layoutRef.current
    const scene = sceneRef.current
    if (!scene) return
    if (y >= layout.overviewTop) {
      // click on the overview → jump: centre the detail window there (keeps zoom)
      const centerFrac = Math.min(Math.max(x / (rect.width || 1), 0), 1)
      setView((v) => clampView(viewFromLensCenter(v, centerFrac, overview), bounds.min, bounds.max))
      return
    }
    const { contentH, visibleH } = scrollMetrics()
    const sy = clampScroll(scrollY, contentH, visibleH)
    for (const g of scene.detail.glyphs) {
      const gy = layout.glyphTop + g.row * layout.rowHeight - sy
      const within = x >= g.xStart - 6 && x <= Math.max(g.xEnd, g.xStart) + 6 && y >= gy - 4 && y <= gy + 12
      if (within) {
        app.select(g.eventId)
        return
      }
    }
    app.select(null) // clicked empty detail space → dismiss the card
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    drag.current = null
  }

  // Resolve against the same `events` the scene rendered (visibleEvents), so a
  // selected glyph in the recycle-bin (trash) view — where events are deleted —
  // still surfaces its detail card instead of resolving to null.
  const selectedEvent =
    state.selectedId != null ? events.find((e) => e.id === state.selectedId) ?? null : null

  return (
    <div ref={wrapRef} className="timeline-view" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      />
      {selectedEvent && (
        <EventDetailCard
          data={buildEventCard(
            selectedEvent,
            { categories: state.categories, tags: state.tags, events: state.events },
            nowYear,
          )}
          onEdit={() => onEdit(selectedEvent.id)}
          onClose={() => app.select(null)}
          onSelectLink={(id) => app.select(id)}
        />
      )}
      <div className="tl-zoom" role="group" aria-label="时间轴显示缩放">
        <button type="button" aria-label="放大" onClick={() => app.setTimelineScale((s) => clampScale(s + 0.25))}>＋</button>
        <button type="button" aria-label="重置缩放" className="tl-zoom-readout" onClick={() => app.setTimelineScale(1)}>
          {scale.toFixed(2).replace(/\.?0+$/, '')}×
        </button>
        <button type="button" aria-label="缩小" onClick={() => app.setTimelineScale((s) => clampScale(s - 0.25))}>－</button>
      </div>
    </div>
  )
}
