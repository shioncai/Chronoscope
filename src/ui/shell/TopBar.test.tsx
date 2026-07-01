// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopBar } from './TopBar'
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
  const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => 'id' })
}

let app: AppStore
beforeEach(() => {
  app = makeApp()
})

function renderTopBar() {
  render(
    <AppStoreProvider value={app}>
      <TopBar onToggleSidebar={() => {}} />
    </AppStoreProvider>,
  )
}

describe('TopBar', () => {
  it('switches the view', async () => {
    renderTopBar()
    await userEvent.click(screen.getByRole('button', { name: '时间轴' }))
    expect(app.store.getState().view).toBe('timeline')
  })
  it('typing in the search box updates the query filter', async () => {
    renderTopBar()
    const box = screen.getByPlaceholderText('搜索事件…')
    await userEvent.type(box, '登月')
    expect(app.store.getState().filter.query).toBe('登月')
  })
  it('no longer renders a 新建 button (moved to FAB)', () => {
    renderTopBar()
    expect(screen.queryByText('新建')).toBeNull()
  })
})
