// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from './Sidebar'
import { createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
import { TestProviders } from '../../test/providers'

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
  vi.restoreAllMocks()
})

const renderSidebar = () =>
  render(
    <TestProviders app={app}>
      <Sidebar open onEdit={() => {}} />
    </TestProviders>,
  )

describe('Sidebar', () => {
  it('renders the four modules and footer controls', () => {
    renderSidebar()
    expect(screen.getByText('所有事件')).toBeTruthy()
    expect(screen.getByText('文件夹')).toBeTruthy()
    expect(screen.getByText('标签')).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: '主题' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '关于' })).toBeTruthy()
  })

  it('sets the theme from the footer switch', async () => {
    renderSidebar()
    await userEvent.click(screen.getByRole('radio', { name: '夜间' }))
    expect(app.store.getState().theme).toBe('night')
    expect(app.store.getState().themeMode).toBe('night')
    await userEvent.click(screen.getByRole('radio', { name: '日间' }))
    expect(app.store.getState().theme).toBe('day')
  })

  it('opens the about dialog', async () => {
    renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: '关于' }))
    expect(screen.getByRole('dialog', { name: '关于' })).toBeTruthy()
  })
})
