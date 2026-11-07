// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ListView } from './ListView'
import { createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
import { TestProviders } from '../../test/providers'

function makeApp(locale?: 'en' | 'zh'): AppStore {
  const db: Database = {
    events: createMemoryRepository<EventRecord>(),
    categories: createMemoryRepository<Category>(),
    tags: createMemoryRepository<Tag>(),
  }
  let t = 0
  let i = 0
  const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}`, locale })
}

let app: AppStore
beforeEach(() => {
  app = makeApp()
})

function renderList(onEdit = () => {}) {
  return render(
    <TestProviders app={app}>
      <ListView onEdit={onEdit} />
    </TestProviders>,
  )
}

describe('ListView', () => {
  it('shows the welcome state when there are no events', () => {
    renderList()
    expect(screen.getByText('还没有事件')).toBeTruthy()
    expect(screen.getByRole('button', { name: '载入示例时间轴' })).toBeTruthy()
  })

  it('loads the sample timeline from the welcome state, and undo takes it away', async () => {
    renderList()
    await userEvent.click(screen.getByRole('button', { name: '载入示例时间轴' }))
    await waitFor(() => expect(screen.getByText('宇宙大爆炸')).toBeTruthy())
    expect(app.store.getState().events.length).toBeGreaterThan(10)
    await app.undo()
    expect(app.store.getState().events.filter((e) => !e.deleted)).toHaveLength(0)
  })

  it('shows a filtered empty state with a reset when the filter hides everything', async () => {
    await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    app.setFilter({ query: 'nothing-matches' })
    renderList()
    expect(screen.getByText('没有匹配的事件')).toBeTruthy()
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
      expect(screen.getByRole('button', { name: h })).toBeTruthy()
    }
  })

  it('toggles sort when a header is clicked', async () => {
    await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
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

  it('clicking the checkbox cell around the box does not open the editor', async () => {
    // The box is small; a near-miss inside its column must not open the editor
    // (the editor opens only from the title column rightward, like the sidebar).
    await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    const onEdit = vi.fn()
    const { container } = renderList(onEdit)
    const cell = container.querySelector('.list-view tbody td.col-check') as HTMLElement
    await userEvent.click(cell)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('clicking the title cell outside the title button does not open the editor', async () => {
    // The editor opens via a dedicated title button, not the whole cell, so the
    // cell's leading padding is a safe buffer well to the right of the checkbox.
    await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    const onEdit = vi.fn()
    const { container } = renderList(onEdit)
    const titleCell = container.querySelector('.list-view tbody tr td:nth-child(2)') as HTMLElement
    await userEvent.click(titleCell)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('renders selection as the shared styled checkbox control (not a native input)', async () => {
    await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    renderList()
    const rowCb = screen.getByRole('checkbox', { name: '选择「x」' })
    expect(rowCb.tagName).toBe('BUTTON')
    expect(rowCb.classList.contains('tree-cb')).toBe(true)
    expect(screen.getByRole('checkbox', { name: '全选' }).tagName).toBe('BUTTON')
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
    const { container } = renderList()
    expect(screen.queryByText(/已选/)).toBeNull()
    await userEvent.click(screen.getByLabelText('选择「x」'))
    // the count text is split across a text node and a <b>{n}</b> node (for
    // the CSS to bold just the number), so check textContent rather than
    // screen.getByText (which only reads direct text-node children).
    expect(container.querySelector('.bb-count')?.textContent).toBe('已选 1 项')
  })

  it('trash mode lists deleted events with checkboxes for restore', async () => {
    const id = await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    await app.deleteEvent(id)
    app.setFilter({ trash: true })
    renderList()
    expect(screen.getByText('x')).toBeTruthy()
    // recycle bin is selectable so events can be restored/purged
    expect(screen.getByLabelText('全选')).toBeTruthy()
    expect(screen.getByLabelText('选择「x」')).toBeTruthy()
  })

  it('trash mode shows restore + permanent-delete actions when an event is checked', async () => {
    const id = await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    await app.deleteEvent(id)
    app.setFilter({ trash: true })
    app.toggleChecked(id)
    renderList()
    const bar = screen.getByRole('toolbar')
    expect(within(bar).getByRole('button', { name: '恢复' })).toBeTruthy()
    expect(within(bar).getByRole('button', { name: '永久删除' })).toBeTruthy()
    // the normal move/tag/delete actions are not offered in the recycle bin
    expect(screen.queryByText(/移动到文件夹/)).toBeNull()
  })

  it('restoring from the recycle bin un-deletes the event', async () => {
    const id = await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    await app.deleteEvent(id)
    app.setFilter({ trash: true })
    app.toggleChecked(id)
    renderList()
    await userEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: '恢复' }))
    expect(app.store.getState().events.find((e) => e.id === id)?.deleted).toBe(false)
  })

  it('the row restore button un-deletes a single event in the recycle bin', async () => {
    const id = await app.createEvent({ title: 'x', start: { year: 1, precision: 'year' } })
    await app.deleteEvent(id)
    app.setFilter({ trash: true })
    renderList()
    await userEvent.click(screen.getByRole('button', { name: '恢复' }))
    expect(app.store.getState().events.find((e) => e.id === id)?.deleted).toBe(false)
  })

  it('renders in English when the store locale is en', () => {
    const enApp = makeApp('en')
    render(
      <TestProviders app={enApp}>
        <ListView onEdit={() => {}} />
      </TestProviders>,
    )
    expect(screen.getByText('No events yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Load sample timeline' })).toBeTruthy()
  })
})
