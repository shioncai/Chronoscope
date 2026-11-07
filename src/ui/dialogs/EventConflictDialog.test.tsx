// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventConflictDialog } from './EventConflictDialog'
import { createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
import { fromYear } from '../../domain/time'
import { TestProviders } from '../../test/providers'

function makeApp(): AppStore {
  const db: Database = { events: createMemoryRepository<EventRecord>(), categories: createMemoryRepository<Category>(), tags: createMemoryRepository<Tag>() }
  let t = 0, i = 0
  return createAppStore({ db, clock: { now: () => `t${++t}` } as Clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}
const ev = (id: string, extra: Partial<EventRecord> = {}): EventRecord =>
  ({ id, title: id, note: '', categoryId: null, tagIds: [], links: [], createdAt: 't0', updatedAt: 't0', deleted: false, start: fromYear(2000, 'year'), ...extra })

let app: AppStore
beforeEach(() => { app = makeApp() })

describe('EventConflictDialog', () => {
  const incoming = ev('inc', { title: '登月', start: fromYear(1970, 'year') })
  const existing = ev('exi', { title: '登月', start: fromYear(1969, 'year') })

  it('confirm returns per-item choices', async () => {
    const onResolve = vi.fn()
    render(
      <TestProviders app={app}>
        <EventConflictDialog title="移动冲突" conflicts={[{ incoming, existing }]} onResolve={onResolve} onCancel={vi.fn()} />
      </TestProviders>,
    )
    await userEvent.click(screen.getByRole('radio', { name: /覆盖/ }))
    await userEvent.click(screen.getByRole('button', { name: '确认' }))
    expect(onResolve).toHaveBeenCalledWith({ inc: 'overwrite' })
  })

  it('cancel calls onCancel', async () => {
    const onCancel = vi.fn()
    render(
      <TestProviders app={app}>
        <EventConflictDialog title="移动冲突" conflicts={[{ incoming, existing }]} onResolve={vi.fn()} onCancel={onCancel} />
      </TestProviders>,
    )
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('renders the Time diff row in English when locale is en', () => {
    app.setLocale('en')
    const incomingDeep = ev('inc-deep', { title: 'Moon Landing', start: fromYear(-2999, 'year') })
    const existingDeep = ev('exi-deep', { title: 'Moon Landing', start: fromYear(1969, 'year') })
    render(
      <TestProviders app={app}>
        <EventConflictDialog title="Move conflict" conflicts={[{ incoming: incomingDeep, existing: existingDeep }]} onResolve={vi.fn()} onCancel={vi.fn()} />
      </TestProviders>,
    )
    const timeRow = screen.getByText('Time').closest('tr')
    expect(timeRow).not.toBeNull()
    expect(timeRow!.textContent).toContain('3000 BCE')
    expect(timeRow!.textContent).not.toMatch(/年/)
  })
})
