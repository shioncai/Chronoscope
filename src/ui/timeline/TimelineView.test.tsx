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
})
