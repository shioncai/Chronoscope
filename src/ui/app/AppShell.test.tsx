// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from './AppShell'
import { createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import { fromYear } from '../../domain/time'
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
afterEach(() => {
  window.localStorage.clear()
})

describe('AppShell', () => {
  it('applies the theme to the document element', () => {
    render(<AppShell app={app} />)
    expect(document.documentElement.getAttribute('data-theme')).toBe('day')
  })

  it('renders the timeline (a canvas) when the timeline view is selected', async () => {
    const { container } = render(<AppShell app={app} />)
    await userEvent.click(screen.getByRole('button', { name: '时间轴' }))
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('creates an event end-to-end: FAB → fill → 保存 → appears in the list', async () => {
    render(<AppShell app={app} />)
    await userEvent.click(screen.getByLabelText('新建事件'))
    await userEvent.type(screen.getByLabelText('标题'), '宇宙大爆炸')
    await userEvent.type(screen.getByLabelText('起点 年'), '2020')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByText('宇宙大爆炸')).toBeTruthy()
  })

  it('clicking the FAB opens the new-event editor', async () => {
    render(<AppShell app={app} />)
    await userEvent.click(screen.getByLabelText('新建事件'))
    expect(screen.getByRole('dialog', { name: '新建事件' })).toBeTruthy()
  })

  // The batch bar needs a second row on a phone to fit its actions, and that row
  // lands exactly where the FAB floats. Mid-selection, "add an event" is not what
  // the hand is reaching for anyway.
  it('stands the FAB down while rows are checked, and brings it back', async () => {
    const id = await app.createEvent({ title: '登月', start: { year: 1969, precision: 'year' } })
    render(<AppShell app={app} />)
    expect(screen.queryByLabelText('新建事件')).not.toBeNull()

    act(() => app.toggleChecked(id))
    expect(screen.queryByLabelText('新建事件')).toBeNull()

    act(() => app.toggleChecked(id))
    expect(screen.queryByLabelText('新建事件')).not.toBeNull()
  })

  it('dragging the resize handle commits a clamped width to localStorage', () => {
    const { container } = render(<AppShell app={app} />)
    const handle = container.querySelector('.sidebar-resize')!
    // drag well past the max — the committed width clamps to 460
    fireEvent.pointerDown(handle)
    fireEvent.pointerMove(window, { clientX: 9999 })
    fireEvent.pointerUp(window, { clientX: 9999 })
    expect(window.localStorage.getItem('cs.sidebarWidth')).toBe('460')
    expect((container.querySelector('.app-shell') as HTMLElement).style.getPropertyValue('--sidebar-w')).toBe('460px')
  })

  it('restores a persisted sidebar width on mount', () => {
    window.localStorage.setItem('cs.sidebarWidth', '320')
    const { container } = render(<AppShell app={app} />)
    expect((container.querySelector('.app-shell') as HTMLElement).style.getPropertyValue('--sidebar-w')).toBe('320px')
  })

  it('toggles the sidebar drawer via the menu button', async () => {
    const { container } = render(<AppShell app={app} />)
    const toggle = screen.getByRole('button', { name: '菜单' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.sidebar')?.classList.contains('open')).toBe(true)
  })

  it('Escape on the restore-conflict dialog closes only that dialog, not the editor', async () => {
    // Nested focus traps: the editor's modal (AppShell) wraps EventEditor, and
    // EventConflictDialog opens its own trap inside it. Escape on the inner
    // dialog must not escalate to the outer trap and tear down the editor.
    const f = await app.createCategory({ name: '历史' })
    const del = await app.createEvent({ title: '登月', categoryId: f, start: fromYear(1969, 'year') })
    await app.deleteEvent(del)
    await app.createEvent({ title: '登月', categoryId: f, start: fromYear(1970, 'year') }) // live same-name
    app.setFilter({ trash: true }) // recycle-bin view surfaces the deleted event
    render(<AppShell app={app} />)
    await userEvent.click(screen.getByText('登月')) // open the deleted event's editor
    await userEvent.click(screen.getByRole('button', { name: '恢复' }))
    expect(await screen.findByText('恢复冲突')).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    // the conflict dialog dismisses…
    expect(screen.queryByText('恢复冲突')).toBeNull()
    // …but the editor stays open and the event is still deleted (not restored).
    expect(screen.getByRole('dialog', { name: '编辑事件' })).toBeTruthy()
    expect(app.store.getState().events.find((e) => e.id === del)?.deleted).toBe(true)
  })
})
