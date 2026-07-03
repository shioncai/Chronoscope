// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventEditor } from './EventEditor'
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
  const clock: Clock = { now: () => `t${++t}` }
  let i = 0
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}

let app: AppStore
beforeEach(() => {
  app = makeApp()
})

function renderEditor(editingId: string | null, onClose = () => {}) {
  return render(
    <AppStoreProvider value={app}>
      <EventEditor editingId={editingId} onClose={onClose} />
    </AppStoreProvider>,
  )
}

describe('EventEditor', () => {
  it('blocks save and shows an error when the title is empty', async () => {
    renderEditor(null)
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByText('标题不能为空')).toBeTruthy()
    expect(app.store.getState().events).toEqual([])
  })

  it('creates an event with a title and a parsed start', async () => {
    let closed = false
    renderEditor(null, () => (closed = true))
    await userEvent.type(screen.getByLabelText('标题'), '登月')
    await userEvent.type(screen.getByLabelText('起点 年'), '1969')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    const events = app.store.getState().events
    expect(events.map((e) => e.title)).toEqual(['登月'])
    expect(events[0].start?.year).toBe(1969)
    expect(closed).toBe(true)
  })

  it('edits an existing event', async () => {
    const id = await app.createEvent({ title: 'old', start: { year: 1, precision: 'year' } })
    renderEditor(id)
    const title = screen.getByLabelText('标题') as HTMLInputElement
    expect(title.value).toBe('old')
    await userEvent.clear(title)
    await userEvent.type(title, 'new')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(app.store.getState().events[0].title).toBe('new')
  })

  it('deletes in edit mode', async () => {
    const id = await app.createEvent({ title: 'gone', start: { year: 1, precision: 'year' } })
    renderEditor(id)
    await userEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(app.store.getState().events[0].deleted).toBe(true)
  })

  it('saves links to other events', async () => {
    const other = await app.createEvent({ title: '另一个', start: { year: 1, precision: 'year' } })
    renderEditor(null)
    await userEvent.type(screen.getByLabelText('标题'), '主事件')
    await userEvent.type(screen.getByLabelText('起点 年'), '2000')
    await userEvent.click(screen.getByRole('button', { name: /关联其他事件/ }))
    await userEvent.click(screen.getByLabelText('另一个'))
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    const created = app.store.getState().events.find((e) => e.title === '主事件')!
    expect(created.links).toEqual([other])
  })

  it('saves an explicit fuzz range on the start', async () => {
    let closed = false
    renderEditor(null, () => (closed = true))
    await userEvent.type(screen.getByLabelText('标题'), '地球形成')
    await userEvent.type(screen.getByLabelText('起点 年'), '1969')
    await userEvent.click(screen.getAllByRole('button', { name: '± 误差范围' })[0])
    await userEvent.type(screen.getByLabelText('起点 模糊±'), '5')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    const e = app.store.getState().events.find((ev) => ev.title === '地球形成')!
    expect(e.start?.fuzz).toEqual({ before: 5, after: 5 })
    expect(closed).toBe(true)
  })

  it('creates a folder inline via the new-folder form and selects it', async () => {
    const parent = await app.createCategory({ name: '历史' })
    renderEditor(null)
    await userEvent.click(screen.getByRole('button', { name: '＋ 新建文件夹' }))
    await userEvent.type(screen.getByLabelText('名称'), '近代')
    await userEvent.selectOptions(screen.getByLabelText('父文件夹'), parent)
    await userEvent.click(screen.getByRole('button', { name: '创建' }))
    const created = app.store.getState().categories.find((c) => c.name === '近代')!
    expect(created.parentId).toBe(parent)
    expect((screen.getByLabelText('文件夹') as HTMLSelectElement).value).toBe(created.id)
  })

  it('toggles a tag via its pill', async () => {
    const tid = await app.createTag({ name: '重要' })
    renderEditor(null)
    await userEvent.click(screen.getByRole('button', { name: /重要/ }))
    await userEvent.type(screen.getByLabelText('标题'), 'x')
    await userEvent.type(screen.getByLabelText('起点 年'), '1')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    const e = app.store.getState().events.find((ev) => ev.title === 'x')!
    expect(e.tagIds).toContain(tid)
  })

  it('reveals the inline new-folder form', async () => {
    renderEditor(null)
    await userEvent.click(screen.getByRole('button', { name: '＋ 新建文件夹' }))
    expect(screen.getByLabelText('名称')).toBeTruthy()
  })

  it('keeps 关联 collapsed until expanded', async () => {
    await app.createEvent({ title: '其它', start: { year: 1, precision: 'year' } })
    renderEditor(null)
    expect(screen.queryByText('其它')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /关联其他事件/ }))
    expect(screen.getByText('其它')).toBeTruthy()
  })

  it('offers restore (not save) for a deleted event and restores it', async () => {
    const id = await app.createEvent({ title: '已删', start: { year: 1, precision: 'year' } })
    await app.deleteEvent(id)
    renderEditor(id)
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull()
    expect(screen.getByRole('button', { name: '永久删除' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '恢复' }))
    expect(app.store.getState().events.find((e) => e.id === id)?.deleted).toBe(false)
  })

  it('blocks saving a new event whose title already exists in the same folder', async () => {
    const f = await app.createCategory({ name: '历史' })
    await app.createEvent({ title: '登月', categoryId: f, start: { year: 1969, precision: 'year' } })
    renderEditor(null)
    await userEvent.type(screen.getByLabelText('标题'), '登月')
    await userEvent.selectOptions(screen.getByLabelText('文件夹'), f)
    await userEvent.type(screen.getByLabelText('起点 年'), '1970')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByText(/该文件夹下已存在同名事件/)).toBeTruthy()
    expect(app.store.getState().events.filter((e) => !e.deleted)).toHaveLength(1)
  })

  it('creates a tag inline and applies it to the event on save', async () => {
    renderEditor(null)
    await userEvent.click(screen.getByRole('button', { name: '＋ 新标签' }))
    await userEvent.type(screen.getByLabelText('标签名称'), '旅行')
    await userEvent.click(screen.getByRole('button', { name: '创建' }))
    await userEvent.type(screen.getByLabelText('标题'), 'x')
    await userEvent.type(screen.getByLabelText('起点 年'), '2000')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    const created = app.store.getState().tags.find((t) => t.name === '旅行')!
    const e = app.store.getState().events.find((ev) => ev.title === 'x')!
    expect(created).toBeTruthy()
    expect(e.tagIds).toContain(created.id)
  })
})
