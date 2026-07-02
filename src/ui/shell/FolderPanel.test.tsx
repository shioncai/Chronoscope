// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FolderPanel } from './FolderPanel'
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
const r = () => render(<AppStoreProvider value={app}><FolderPanel /></AppStoreProvider>)

describe('FolderPanel', () => {
  it('toggles the add-folder form from the ＋ button', async () => {
    r()
    await userEvent.click(screen.getByLabelText('添加文件夹'))
    expect(screen.getByLabelText('名称')).toBeTruthy()
  })
  it('clicking a folder sets the category filter', async () => {
    const id = await app.createCategory({ name: '历史' })
    r()
    await userEvent.click(screen.getByText('历史'))
    expect(app.store.getState().filter.categoryId).toBe(id)
  })
})
