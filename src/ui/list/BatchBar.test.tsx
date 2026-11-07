// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BatchBar } from './BatchBar'
import { createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import { fromYear } from '../../domain/time'
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

const renderBar = (trash = false) =>
  render(
    <TestProviders app={app}>
      <BatchBar trash={trash} />
    </TestProviders>,
  )

describe('BatchBar', () => {
  it('does not render when nothing is checked', () => {
    renderBar()
    expect(screen.queryByText(/已选/)).toBeNull()
  })

  it('shows the selected count when items are checked', async () => {
    const id = await app.createEvent({ title: 'x' })
    app.toggleChecked(id)
    const { container } = renderBar()
    // the count text is split across a text node and a <b>{n}</b> node (for
    // the CSS to bold just the number), so check the rendered textContent
    // rather than screen.getByText (which only reads direct text-node children).
    expect(container.querySelector('.bb-count')?.textContent).toBe('已选 1 项')
  })

  it('moves checked events to a folder via the menu', async () => {
    const c = await app.createCategory({ name: '科技' })
    await app.createEvent({ title: 'a' })
    app.setChecked(['id2'])
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: '移动到文件夹' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '科技' }))
    expect(app.store.getState().events.find((e) => e.id === 'id2')?.categoryId).toBe(c)
  })

  it('clears the category via the menu top item (未分类)', async () => {
    const c = await app.createCategory({ name: '科技' })
    await app.createEvent({ title: 'a', categoryId: c })
    app.setChecked(['id2'])
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: '移动到文件夹' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '未分类' }))
    expect(app.store.getState().events.find((e) => e.id === 'id2')?.categoryId).toBeNull()
  })

  it('adds a tag to checked events', async () => {
    const t = await app.createTag({ name: '里程碑' })
    await app.createEvent({ title: 'a' })
    app.setChecked(['id2'])
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: '添加标签' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '里程碑' }))
    expect(app.store.getState().events.find((e) => e.id === 'id2')?.tagIds).toEqual([t])
  })

  it('remove-tag menu lists only tags present on the selection', async () => {
    const onSel = await app.createTag({ name: '在选中上' })
    await app.createTag({ name: '不在选中上' })
    await app.createEvent({ title: 'a', tagIds: [onSel] })
    app.setChecked(['id3'])
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: '移除标签' }))
    expect(screen.getByRole('menuitem', { name: '在选中上' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: '不在选中上' })).toBeNull()
    await userEvent.click(screen.getByRole('menuitem', { name: '在选中上' }))
    expect(app.store.getState().events.find((e) => e.id === 'id3')?.tagIds).toEqual([])
  })

  it('deletes checked events at once and clears the selection', async () => {
    await app.createEvent({ title: 'a' })
    await app.createEvent({ title: 'b' })
    app.setChecked(['id1', 'id2'])
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(app.store.getState().events.find((e) => e.id === 'id1')?.deleted).toBe(true)
    expect(app.store.getState().checkedIds).toEqual([])
  })

  it('offers undo after a batch delete, which brings every event back', async () => {
    await app.createEvent({ title: 'a' })
    await app.createEvent({ title: 'b' })
    app.setChecked(['id1', 'id2'])
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: '删除' }))
    await userEvent.click(await screen.findByRole('button', { name: '撤销' }))
    expect(app.store.getState().events.filter((e) => e.deleted)).toHaveLength(0)
  })

  it('取消 clears the selection', async () => {
    await app.createEvent({ title: 'a' })
    app.setChecked(['id1'])
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: '取消选择' }))
    expect(app.store.getState().checkedIds).toEqual([])
  })

  it('restoring into a folder with a live same-name event prompts a conflict dialog', async () => {
    const f = await app.createCategory({ name: '历史' })
    const del = await app.createEvent({ title: '登月', categoryId: f, start: fromYear(1969, 'year') })
    await app.deleteEvent(del)
    await app.createEvent({ title: '登月', categoryId: f, start: fromYear(1970, 'year') })
    app.setFilter({ trash: true }) // enter recycle-bin view (the real filter flag; also clears checkedIds)
    app.setChecked([del])
    renderBar(true) // BatchBar reads its trash mode from the `trash` prop, as ListView passes it
    await userEvent.click(screen.getByRole('button', { name: '恢复' }))
    expect(await screen.findByText('恢复冲突')).toBeTruthy()
    await userEvent.click(screen.getByRole('radio', { name: /覆盖/ }))
    await userEvent.click(screen.getByRole('button', { name: '确认' }))
    await waitFor(() => expect(app.store.getState().events.find((e) => e.id === del)?.deleted).toBe(false))
  })

  it('moving into a folder with a live same-name event prompts, and overwrite permanently removes the occupant', async () => {
    const f = await app.createCategory({ name: '历史' })
    const occupant = await app.createEvent({ title: '登月', categoryId: f, start: fromYear(1969, 'year') }) // existing in target
    const mv = await app.createEvent({ title: '登月', categoryId: null, start: fromYear(1970, 'year') }) // moving in → conflict
    app.setChecked([mv])
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: '移动到文件夹' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '历史' }))
    expect(await screen.findByText('移动冲突')).toBeTruthy()
    await userEvent.click(screen.getByRole('radio', { name: /覆盖/ }))
    await userEvent.click(screen.getByRole('button', { name: '确认' }))
    await waitFor(() => {
      const s = app.store.getState()
      expect(s.events.find((e) => e.id === mv)?.categoryId).toBe(f) // moved event wins completely
      expect(s.events.find((e) => e.id === occupant)).toBeUndefined() // occupant permanently removed (not to trash)
    })
  })

  it('moving two same-name events into one folder keeps only the first (auto-skips the dup)', async () => {
    const target = await app.createCategory({ name: '目标' })
    const a = await app.createCategory({ name: 'A' })
    const b = await app.createCategory({ name: 'B' })
    const e1 = await app.createEvent({ title: '登月', categoryId: a, start: fromYear(1969, 'year') })
    const e2 = await app.createEvent({ title: '登月', categoryId: b, start: fromYear(1970, 'year') })
    app.setChecked([e1, e2])
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: '移动到文件夹' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '目标' }))
    await waitFor(() => {
      const s = app.store.getState()
      const inTarget = s.events.filter((e) => !e.deleted && e.categoryId === target)
      expect(inTarget).toHaveLength(1) // exactly one lands
      expect(inTarget[0].id).toBe(e1) // keep-first
      const other = s.events.find((e) => e.id === e2)
      expect(other?.categoryId).toBe(b) // the dup stayed put
      expect(other?.deleted).toBe(false) // and was not deleted
    })
  })
})
