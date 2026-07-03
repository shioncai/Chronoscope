// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddFolderForm } from './AddFolderForm'
import { AppStoreProvider, createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
import { CATEGORY_PRESETS } from '../categoryColors'
function makeApp(): AppStore {
  const db: Database = { events: createMemoryRepository<EventRecord>(), categories: createMemoryRepository<Category>(), tags: createMemoryRepository<Tag>() }
  let t = 0, i = 0; const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}
let app: AppStore
beforeEach(() => { app = makeApp() })

describe('AddFolderForm', () => {
  it('creates a top-level folder with name and a preset color', async () => {
    const onCreated = vi.fn()
    render(<AppStoreProvider value={app}><AddFolderForm defaultParentId={null} onCreated={onCreated} onCancel={() => {}} /></AppStoreProvider>)
    await userEvent.type(screen.getByLabelText('名称'), '宋朝')
    await userEvent.click(screen.getByRole('button', { name: '创建' }))
    const folder = app.store.getState().categories.find((c) => c.name === '宋朝')!
    expect(folder).toBeTruthy()
    expect(CATEGORY_PRESETS as readonly string[]).toContain(folder.color)
    expect(onCreated).toHaveBeenCalled()
  })

  it('inherits the parent folder color by default', async () => {
    const pid = await app.createCategory({ name: '历史', color: '#5b8def' })
    render(<AppStoreProvider value={app}><AddFolderForm defaultParentId={pid} onCreated={() => {}} onCancel={() => {}} /></AppStoreProvider>)
    await userEvent.type(screen.getByLabelText('名称'), '近代史')
    await userEvent.click(screen.getByRole('button', { name: '创建' }))
    const child = app.store.getState().categories.find((c) => c.name === '近代史')!
    expect(child.color).toBe('#5b8def')
  })

  it('rejects creating a folder whose name duplicates a live sibling', async () => {
    await app.createCategory({ name: '历史', parentId: null })
    const onCreated = vi.fn()
    render(<AppStoreProvider value={app}><AddFolderForm defaultParentId={null} onCreated={onCreated} onCancel={() => {}} /></AppStoreProvider>)
    await userEvent.type(screen.getByLabelText('名称'), '历史')
    await userEvent.click(screen.getByRole('button', { name: '创建' }))
    expect(screen.getByText(/已存在同名文件夹/)).toBeTruthy()
    expect(app.store.getState().categories.filter((c) => !c.deleted)).toHaveLength(1)
    expect(onCreated).not.toHaveBeenCalled()
  })
})
