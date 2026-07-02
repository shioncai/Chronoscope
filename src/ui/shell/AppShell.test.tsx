// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from './AppShell'
import { createAppStore, type AppStore } from '../../state'
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
})
