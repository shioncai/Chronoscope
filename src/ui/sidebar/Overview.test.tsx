// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Overview } from './Overview'
import { createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
import { TestProviders } from '../../test/providers'
function makeApp(): AppStore {
  const db: Database = { events: createMemoryRepository<EventRecord>(), categories: createMemoryRepository<Category>(), tags: createMemoryRepository<Tag>() }
  let t = 0, i = 0; const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}
let app: AppStore
beforeEach(() => { app = makeApp() })
const r = () => render(<TestProviders app={app}><Overview /></TestProviders>)

describe('Overview', () => {
  it('clicking 未标签事件 sets the untagged filter and clears tags', async () => {
    r()
    await userEvent.click(screen.getByText('未标签事件'))
    expect(app.store.getState().filter.untagged).toBe(true)
    expect(app.store.getState().filter.tagIds).toEqual([])
  })
  it('clicking 所有事件 resets structural filters', async () => {
    app.setFilter({ uncategorized: true })
    r()
    await userEvent.click(screen.getByText('所有事件'))
    const f = app.store.getState().filter
    expect(f.uncategorized).toBe(false)
    expect(f.untagged).toBe(false)
    expect(f.trash).toBe(false)
  })
  it('clicking 未分类事件 sets the uncategorized filter', async () => {
    r()
    await userEvent.click(screen.getByText('未分类事件'))
    expect(app.store.getState().filter.uncategorized).toBe(true)
  })
  it('renders row labels in English after switching locale', () => {
    app.setLocale('en')
    r()
    expect(screen.getByText('All events')).toBeTruthy()
  })
})
