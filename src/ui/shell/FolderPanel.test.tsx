// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  it('deletes a folder after confirmation', async () => {
    const id = await app.createCategory({ name: '历史' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    r()
    await userEvent.click(screen.getByLabelText('删除文件夹「历史」'))
    expect(confirm).toHaveBeenCalled()
    expect(app.store.getState().categories.find((c) => c.id === id)?.deleted).toBe(true)
    confirm.mockRestore()
  })
  it('does not delete a folder when confirmation is cancelled', async () => {
    const id = await app.createCategory({ name: '历史' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    r()
    await userEvent.click(screen.getByLabelText('删除文件夹「历史」'))
    expect(app.store.getState().categories.find((c) => c.id === id)?.deleted).toBe(false)
    confirm.mockRestore()
  })
  it('collapsing a folder hides its children', async () => {
    const p = await app.createCategory({ name: '历史' })
    await app.createCategory({ name: '古代史', parentId: p })
    r()
    expect(screen.getByText('古代史')).toBeTruthy()
    await userEvent.click(screen.getByLabelText('折叠「历史」'))
    expect(screen.queryByText('古代史')).toBeNull()
  })
})
