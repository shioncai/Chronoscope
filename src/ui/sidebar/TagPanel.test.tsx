// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagPanel } from './TagPanel'
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
const r = () => render(<TestProviders app={app}><TagPanel /></TestProviders>)

describe('TagPanel', () => {
  it('toggles a tag into the filter via its pill', async () => {
    const id = await app.createTag({ name: '重要' })
    r()
    await userEvent.click(screen.getByText('重要'))
    expect(app.store.getState().filter.tagIds).toContain(id)
  })
  it('switches tag mode between OR and AND once there is more than one tag', async () => {
    await app.createTag({ name: '重要' })
    await app.createTag({ name: '旅行' })
    r()
    await userEvent.click(screen.getByRole('button', { name: /切换/ }))
    expect(app.store.getState().filter.tagMode).toBe('and')
    expect(screen.getByRole('button', { name: /切换/ }).textContent).toBe('全部')
  })
  it('renames a tag on double-click', async () => {
    const id = await app.createTag({ name: '重要' })
    r()
    await userEvent.dblClick(screen.getByText('重要'))
    const input = screen.getByLabelText(/重命名/)
    await userEvent.clear(input)
    await userEvent.type(input, '关键{Enter}')
    expect(app.store.getState().tags.find((t) => t.id === id)?.name).toBe('关键')
  })
  it('creates a tag via the inline form', async () => {
    r()
    await userEvent.click(screen.getByLabelText('添加标签'))
    await userEvent.type(screen.getByLabelText('标签名称'), '旅行')
    await userEvent.click(screen.getByRole('button', { name: '创建' }))
    expect(app.store.getState().tags.some((t) => !t.deleted && t.name === '旅行')).toBe(true)
  })
  it('deletes a tag at once and undo brings it back', async () => {
    const id = await app.createTag({ name: '重要' })
    r()
    await userEvent.click(screen.getByRole('button', { name: '删除「重要」' }))
    expect(app.store.getState().tags.find((t) => t.id === id)?.deleted).toBe(true)
    await userEvent.click(await screen.findByRole('button', { name: '撤销' }))
    expect(app.store.getState().tags.find((t) => t.id === id)?.deleted).toBe(false)
  })
})
