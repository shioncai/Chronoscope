// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  it('clicking a folder solos it into the scope', async () => {
    const id = await app.createCategory({ name: '历史' })
    r()
    await userEvent.click(screen.getByText('历史'))
    expect(app.store.getState().filter.scope.folderIds).toEqual([id])
  })
  it('clicking a folder clears the untagged filter', async () => {
    const id = await app.createCategory({ name: '历史' })
    app.setFilter({ untagged: true })
    r()
    await userEvent.click(screen.getByText('历史'))
    expect(app.store.getState().filter.untagged).toBe(false)
    expect(app.store.getState().filter.scope.folderIds).toEqual([id])
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

  it('promotes a subfolder to top level when dropped on the tail strip', async () => {
    const parent = await app.createCategory({ name: '历史' })
    const child = await app.createCategory({ name: '近代史', parentId: parent })
    const { container } = r()
    const childRow = [...container.querySelectorAll('.folder-row')].find((el) => el.textContent?.includes('近代史'))!
    const tail = container.querySelector('.folder-tail')!
    fireEvent.dragStart(childRow)
    fireEvent.dragOver(tail)
    fireEvent.drop(tail)
    await waitFor(() => expect(app.store.getState().categories.find((c) => c.id === child)?.parentId).toBeNull())
  })

  it('renames a folder via the rename control', async () => {
    const id = await app.createCategory({ name: '历史' })
    r()
    await userEvent.click(screen.getByLabelText('重命名文件夹「历史」'))
    const input = screen.getByLabelText('重命名「历史」')
    await userEvent.clear(input)
    await userEvent.type(input, '近代史{Enter}')
    expect(app.store.getState().categories.find((c) => c.id === id)?.name).toBe('近代史')
  })

  it('rejects renaming a folder onto a live sibling name', async () => {
    await app.createCategory({ name: '历史', parentId: null })
    const b = await app.createCategory({ name: '科学', parentId: null })
    r()
    await userEvent.click(screen.getByLabelText('重命名文件夹「科学」'))
    const input = screen.getByLabelText('重命名「科学」')
    await userEvent.clear(input)
    await userEvent.type(input, '历史{Enter}')
    expect(screen.getByText(/已存在同名文件夹/)).toBeTruthy()
    await waitFor(() => expect(app.store.getState().categories.find((c) => c.id === b)?.name).toBe('科学'))
  })

  it('rejects a drag-move onto a parent that already has a live child with that name', async () => {
    const parent = await app.createCategory({ name: '历史' })
    await app.createCategory({ name: '近代史', parentId: parent })
    const dragged = await app.createCategory({ name: '近代史' })
    const { container } = r()
    const rows = [...container.querySelectorAll('.folder-row')]
    const dragRow = rows.find(
      (el) => el.textContent?.includes('近代史') && (el as HTMLElement).style.paddingLeft === '8px',
    )!
    const parentRow = rows.find((el) => el.textContent?.includes('历史'))!
    fireEvent.dragStart(dragRow)
    fireEvent.dragOver(parentRow)
    fireEvent.drop(parentRow)
    await new Promise((res) => setTimeout(res, 0))
    expect(app.store.getState().categories.find((c) => c.id === dragged)?.parentId).toBeNull()
  })

  it('rejects a tail-drop promotion when a live top-level folder already has that name', async () => {
    await app.createCategory({ name: '历史' })                          // top-level 历史
    const parent = await app.createCategory({ name: '科学' })            // some other parent
    const child = await app.createCategory({ name: '历史', parentId: parent }) // child also named 历史
    const { container } = r()
    const rows = [...container.querySelectorAll('.folder-row')]
    const childRow = rows.find(
      (el) => el.textContent?.includes('历史') && (el as HTMLElement).style.paddingLeft === '24px',
    )!
    const tail = container.querySelector('.folder-tail')!
    fireEvent.dragStart(childRow)
    fireEvent.dragOver(tail)
    fireEvent.drop(tail)
    await new Promise((res) => setTimeout(res, 0))
    expect(app.store.getState().categories.find((c) => c.id === child)?.parentId).toBe(parent)
  })
})
