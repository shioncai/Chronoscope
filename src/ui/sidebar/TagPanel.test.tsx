// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  it('creates a tag via the inline form', async () => {
    r()
    await userEvent.click(screen.getByLabelText('添加标签'))
    await userEvent.type(screen.getByLabelText('标签名称'), '旅行')
    await userEvent.click(screen.getByRole('button', { name: '创建' }))
    expect(app.store.getState().tags.some((t) => !t.deleted && t.name === '旅行')).toBe(true)
  })
  it('deletes a tag after confirmation', async () => {
    const id = await app.createTag({ name: '重要' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    r()
    await userEvent.click(screen.getByRole('button', { name: '删除「重要」' }))
    expect(app.store.getState().tags.find((t) => t.id === id)?.deleted).toBe(true)
    confirm.mockRestore()
  })
})
