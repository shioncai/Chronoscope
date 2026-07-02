// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagPanel } from './TagPanel'
import { AppStoreProvider, createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
function makeApp(): AppStore {
  const db: Database = { events: createMemoryRepository<EventRecord>(), categories: createMemoryRepository<Category>(), tags: createMemoryRepository<Tag>() }
  let t = 0, i = 0; const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}
let app: AppStore
beforeEach(() => { app = makeApp() })
const r = () => render(<AppStoreProvider value={app}><TagPanel /></AppStoreProvider>)

describe('TagPanel', () => {
  it('toggles a tag into the filter via its pill', async () => {
    const id = await app.createTag({ name: '重要' })
    r()
    await userEvent.click(screen.getByText('重要'))
    expect(app.store.getState().filter.tagIds).toContain(id)
  })
  it('switches tag mode between OR and AND', async () => {
    r()
    await userEvent.click(screen.getByRole('button', { name: /切换/ }))
    expect(app.store.getState().filter.tagMode).toBe('and')
  })
})
