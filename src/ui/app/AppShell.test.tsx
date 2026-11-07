// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
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
    await app.createEvent({ title: '登月', start: { year: 1969, precision: 'year' } })
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
    await userEvent.click(within(screen.getByRole('dialog', { name: '编辑事件' })).getByRole('button', { name: '恢复' }))
    expect(await screen.findByText('恢复冲突')).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    // the conflict dialog dismisses…
    expect(screen.queryByText('恢复冲突')).toBeNull()
    // …but the editor stays open and the event is still deleted (not restored).
    expect(screen.getByRole('dialog', { name: '编辑事件' })).toBeTruthy()
    expect(app.store.getState().events.find((e) => e.id === del)?.deleted).toBe(true)
  })

  it('Ctrl+Z undoes the last change and Ctrl+Shift+Z redoes it', async () => {
    render(<AppShell app={app} />)
    await act(() => app.createEvent({ title: '登月', start: fromYear(1969, 'year') }))
    expect(screen.getByText('登月')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    await screen.findByText('还没有事件')
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(await screen.findByText('登月')).toBeTruthy()
  })

  it('the top-bar undo button is disabled until there is something to undo', async () => {
    render(<AppShell app={app} />)
    const undo = screen.getByRole('button', { name: '撤销' }) as HTMLButtonElement
    expect(undo.disabled).toBe(true)
    await act(() => app.createEvent({ title: '登月', start: fromYear(1969, 'year') }))
    expect(undo.disabled).toBe(false)
  })

  it('single-key shortcuts: N opens a new event, ? opens the shortcut sheet, 2 switches view', async () => {
    await app.createEvent({ title: '登月', start: fromYear(1969, 'year') })
    const { container } = render(<AppShell app={app} />)
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.getByRole('dialog', { name: '键盘快捷键' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    fireEvent.keyDown(window, { key: '2' })
    expect(container.querySelector('canvas')).not.toBeNull()
    fireEvent.keyDown(window, { key: 'n' })
    expect(screen.getByRole('dialog', { name: '新建事件' })).toBeTruthy()
  })

  it('ignores single-key shortcuts while typing in the search box', async () => {
    render(<AppShell app={app} />)
    const search = screen.getByRole('searchbox')
    search.focus()
    fireEvent.keyDown(search, { key: 'n' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the filter bar while a search is active and clears it from there', async () => {
    await app.createEvent({ title: '登月', start: fromYear(1969, 'year') })
    await app.createEvent({ title: '长城', start: fromYear(-200, 'year') })
    render(<AppShell app={app} />)
    expect(screen.queryByRole('region', { name: '当前筛选' })).toBeNull()
    await userEvent.type(screen.getByRole('searchbox'), '登')
    const bar = await screen.findByRole('region', { name: '当前筛选' })
    expect(bar.textContent).toContain('1')
    await userEvent.click(within(bar).getByRole('button', { name: '清除筛选' }))
    expect(app.store.getState().filter.query).toBe('')
  })
})
