// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ListView } from './ListView'
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
  let i = 0
  const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}

let app: AppStore
beforeEach(() => {
  app = makeApp()
})

function renderList(onEdit = () => {}) {
  return render(
    <AppStoreProvider value={app}>
      <ListView onEdit={onEdit} />
    </AppStoreProvider>,
  )
}

describe('ListView', () => {
  it('shows an empty state when there are no events', () => {
    renderList()
    expect(screen.getByText('暂无事件')).toBeTruthy()
  })

  it('renders rows with formatted time and title', async () => {
    await app.createEvent({ title: '登月', start: { year: 1969, precision: 'year' } })
    renderList()
    expect(screen.getByText('登月')).toBeTruthy()
    expect(screen.getByText('1969年')).toBeTruthy()
  })

  it('clicking the row body opens the editor', async () => {
    const id = await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    const onEdit = vi.fn()
    renderList(onEdit)
    await userEvent.click(screen.getByText('x'))
    expect(onEdit).toHaveBeenCalledWith(id)
  })

  it('renders the new column headers', async () => {
    await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    renderList()
    for (const h of ['标题', '时间', '文件夹', '标签', '备注']) {
      expect(screen.getByRole('button', { name: new RegExp(h) })).toBeTruthy()
    }
  })

  it('toggles sort when a header is clicked', async () => {
    renderList()
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    expect(app.store.getState().sort).toEqual({ key: 'title', dir: 'asc' })
    await userEvent.click(screen.getByRole('button', { name: '标题' }))
    expect(app.store.getState().sort).toEqual({ key: 'title', dir: 'desc' })
  })

  it('renders a degraded event (fine precision, missing civil) without crashing', async () => {
    // Regression: such a record formerly blanked the whole page when the list
    // formatted its start. It must now render (formatTimePoint falls back).
    await app.createEvent({ title: '坏点', start: { year: 2026, precision: 'day' } })
    expect(() => renderList()).not.toThrow()
    expect(screen.getByText('坏点')).toBeTruthy()
    expect(screen.getByText('2026年')).toBeTruthy() // year fallback
  })

  it('checkbox toggles checked without opening the editor', async () => {
    const id = await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    const onEdit = vi.fn()
    renderList(onEdit)
    await userEvent.click(screen.getByLabelText('选择「x」'))
    expect(app.store.getState().checkedIds).toContain(id)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('select-all checks every visible row; clicking again clears them', async () => {
    await app.createEvent({ title: 'a', start: { year: 1, precision: 'year' } })
    await app.createEvent({ title: 'b', start: { year: 2, precision: 'year' } })
    renderList()
    await userEvent.click(screen.getByLabelText('全选'))
    expect(app.store.getState().checkedIds.sort()).toEqual(['id1', 'id2'])
    await userEvent.click(screen.getByLabelText('全选'))
    expect(app.store.getState().checkedIds).toEqual([])
  })

  it('shows the BatchBar only when something is checked', async () => {
    await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    renderList()
    expect(screen.queryByText(/已选/)).toBeNull()
    await userEvent.click(screen.getByLabelText('选择「x」'))
    expect(screen.getByText('已选 1 项')).toBeTruthy()
  })

  it('trash mode hides checkboxes and the BatchBar', async () => {
    const id = await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    await app.deleteEvent(id)
    app.setFilter({ trash: true })
    renderList()
    expect(screen.getByText('x')).toBeTruthy()
    expect(screen.queryByLabelText('全选')).toBeNull()
    expect(screen.queryByLabelText('选择「x」')).toBeNull()
    expect(screen.queryByText(/已选/)).toBeNull()
  })
})
