// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimelineView } from './TimelineView'
import { AppStoreProvider, createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'

function makeApp(): AppStore {
  const db: Database = {
    events: createMemoryRepository<EventRecord>(),
    categories: createMemoryRepository<Category>(),
    tags: createMemoryRepository<Tag>(),
  }
  let t = 0
  let i = 0
  const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}

let app: AppStore
beforeEach(() => {
  app = makeApp()
})

function renderTimeline() {
  return render(
    <AppStoreProvider value={app}>
      <TimelineView onEdit={() => {}} />
    </AppStoreProvider>,
  )
}

describe('TimelineView', () => {
  it('renders a canvas without crashing when there are no events', () => {
    const { container } = renderTimeline()
    expect(container.querySelector('canvas')).not.toBeNull()
  })
  it('renders without crashing with events present (jsdom has no 2D context)', async () => {
    await app.createEvent({ title: '登月', start: { year: 1969, precision: 'year' } })
    await app.createEvent({ title: '区间', start: { year: 1950, precision: 'year' }, end: { year: 1980, precision: 'year' } })
    expect(() => renderTimeline()).not.toThrow()
    expect(document.querySelector('canvas')).not.toBeNull()
  })
  it('shows a detail card for the selected event', async () => {
    const id = await app.createEvent({ title: '登月', start: { year: 1969, precision: 'year' } })
    app.select(id)
    renderTimeline()
    expect(screen.getByText('登月')).toBeTruthy()
  })
  it('writes scale changes into the store so they survive a view switch', async () => {
    await app.createEvent({
      title: 'a',
      start: { year: 1000, precision: 'year' },
      end: { year: 2000, precision: 'year' },
    })
    const { container } = renderTimeline()
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    // jsdom has no layout; give the canvas a non-zero rect so the wheel handler
    // computes a real cursor fraction.
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 1000, bottom: 400, width: 1000, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    expect(app.store.getState().timelineView).toBeNull()
    expect(app.store.getState().timelineOverview).toBeNull()
    fireEvent.wheel(canvas, { clientX: 500, clientY: 10, deltaY: -100 })
    const s = app.store.getState()
    expect(s.timelineView !== null || s.timelineOverview !== null).toBe(true)
  })
  it('the + button raises the store scale by one step', () => {
    renderTimeline()
    expect(app.store.getState().timelineScale).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: '放大' }))
    expect(app.store.getState().timelineScale).toBeCloseTo(1.25, 6)
  })
  it('the − button never drops below 1×', () => {
    renderTimeline()
    fireEvent.click(screen.getByRole('button', { name: '缩小' }))
    expect(app.store.getState().timelineScale).toBe(1)
  })
  it('clicking the readout resets scale to 1×', () => {
    app.setTimelineScale(2.25)
    renderTimeline()
    fireEvent.click(screen.getByRole('button', { name: '重置缩放' }))
    expect(app.store.getState().timelineScale).toBe(1)
  })
  it('does not throw on a vertical drag gesture', () => {
    const { container } = renderTimeline()
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 1000, bottom: 400, width: 1000, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    expect(() => {
      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 500, clientY: 100 })
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 505, clientY: 160 })
      fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 505, clientY: 160 })
    }).not.toThrow()
  })

  describe('pinch', () => {
    const W = 1000 // canvas width the stubbed rect reports

    async function pinchable() {
      await app.createEvent({
        title: 'a',
        start: { year: 1000, precision: 'year' },
        end: { year: 2000, precision: 'year' },
      })
      const { container } = renderTimeline()
      const canvas = container.querySelector('canvas') as HTMLCanvasElement
      canvas.getBoundingClientRect = () =>
        ({ left: 0, top: 0, right: W, bottom: 400, width: W, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
      // Start from an explicit window well inside the bounds. jsdom does no
      // layout, so the component's own layout puts the overview band at a
      // negative y and every pointer would otherwise be read as an overview
      // grab; seeding the view keeps these tests about the pinch alone.
      app.setTimelineView({ min: 1400, max: 1600 })
      return canvas
    }
    const view = () => app.store.getState().timelineView!
    const width = () => view().max - view().min
    // the year the timeline is painting under a given screen x
    const yearUnder = (x: number) => {
      const v = view()
      return v.min + (x / W) * (v.max - v.min)
    }

    // The one that shipped to a phone. A pinch is a scale AND a translation, but
    // this only ever scaled — about a midpoint that moves as the fingers spread.
    // So the timeline slid out from under the fingers, further the longer the
    // gesture ran: short pinches looked fine, long ones were chaos.
    it('keeps the year under a stationary finger pinned while the other spreads', async () => {
      const canvas = await pinchable()
      const THUMB = 250

      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: THUMB, clientY: 100 })
      fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 350, clientY: 100 })
      const pinned = yearUnder(THUMB)

      // the thumb never moves; the index finger travels a long way
      for (const x of [450, 550, 650, 750, 850, 950]) {
        fireEvent.pointerMove(canvas, { pointerId: 2, clientX: x, clientY: 100 })
      }

      expect(yearUnder(THUMB)).toBeCloseTo(pinned, 6)
    })

    it('zooms by exactly the span ratio', async () => {
      const canvas = await pinchable()
      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 400, clientY: 100 })
      fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 600, clientY: 100 })
      const before = width()

      // spread symmetrically about the midpoint: span 200 -> 400
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 350, clientY: 100 })
      fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 650, clientY: 100 })
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 300, clientY: 100 })
      fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 700, clientY: 100 })

      expect(before / width()).toBeCloseTo(400 / 200, 3)
    })

    // Two fingers moving together, span unchanged: the old code computed a pinch
    // factor of exactly 1 and then did nothing at all.
    it('pans when two fingers travel together without changing their span', async () => {
      const canvas = await pinchable()
      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 400, clientY: 100 })
      fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 600, clientY: 100 })
      const before = view()

      // both slide 100px right; the content must follow the fingers
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 500, clientY: 100 })
      fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 700, clientY: 100 })

      const after = view()
      expect(after.max - after.min).toBeCloseTo(before.max - before.min, 6) // no zoom
      expect(after.min).toBeCloseTo(before.min - (100 / W) * (before.max - before.min), 6)
    })

    // A finger that lands and then drags was never written back to the pointer
    // map, so the second finger's arrival measured the opening span against the
    // first one's LANDING x — and the first zoom step jumped.
    it('measures the opening span from where the first finger is now, not where it landed', async () => {
      const canvas = await pinchable()

      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 400, clientY: 100 })
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 300, clientY: 100 })
      app.setTimelineView({ min: 1400, max: 1600 }) // discard whatever the drag did
      const before = width()

      // the live span is |600 - 300| = 300, and spreading to 280 makes it 320
      fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 600, clientY: 100 })
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 280, clientY: 100 })

      expect(before / width()).toBeCloseTo(320 / 300, 3)
    })

    // Lifting one finger left the survivor inert: the pinch branch no longer
    // applied and no drag had been armed, so the timeline stopped responding
    // until every finger was off the glass.
    it('hands the surviving finger back to panning when its partner lifts', async () => {
      const canvas = await pinchable()
      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 400, clientY: 100 })
      fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 600, clientY: 100 })
      fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 400, clientY: 100 })

      const before = view()
      fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 700, clientY: 100 })
      const after = view()

      expect(after.max - after.min).toBeCloseTo(before.max - before.min, 6) // panned, not zoomed
      expect(after.min).toBeCloseTo(before.min - (100 / W) * (before.max - before.min), 6)
    })
  })
})
