// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SidebarFooter } from './SidebarFooter'
import { AppStoreProvider, createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
import { fromYear } from '../../domain/time'

function makeApp(): AppStore {
  const db: Database = { events: createMemoryRepository<EventRecord>(), categories: createMemoryRepository<Category>(), tags: createMemoryRepository<Tag>() }
  let t = 0, i = 0
  const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}
let app: AppStore
beforeEach(() => { app = makeApp() })
const r = () => render(<AppStoreProvider value={app}><SidebarFooter /></AppStoreProvider>)

describe('SidebarFooter export/import', () => {
  it('exports via a download using URL.createObjectURL', async () => {
    await app.createEvent({ title: '登月', start: fromYear(1969, 'year') })
    const createObjectURL = vi.fn(() => 'blob:x')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    r()
    await userEvent.click(screen.getByText('导出数据'))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('imports a selected file and shows a result summary', async () => {
    // a file authored by a separate store
    const src = makeApp()
    const cid = await src.createCategory({ name: '历史' })
    await src.createEvent({ title: '登月', categoryId: cid, start: fromYear(1969, 'year') })
    const text = JSON.stringify(src.exportData())
    const file = new File([text], 'backup.json', { type: 'application/json' })

    r()
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByText('导入完成')).toBeTruthy())
    expect(app.store.getState().events.some((e) => e.title === '登月')).toBe(true)
    expect(screen.getByText(/新增事件/).closest('div')?.textContent).toContain('1')
  })

  it('shows an error dialog for a bad file', async () => {
    const file = new File(['{garbage'], 'x.json', { type: 'application/json' })
    r()
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('导入失败')).toBeTruthy())
  })

  it('renders the footer in English after switching locale', async () => {
    const app = makeApp()
    app.setLocale('en')
    render(<AppStoreProvider value={app}><SidebarFooter /></AppStoreProvider>)
    expect(screen.getByText('Export data')).toBeTruthy()
    expect(screen.getByText('English')).toBeTruthy()
  })
})
