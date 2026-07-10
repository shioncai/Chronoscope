// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoveMenu } from './MoveMenu'
import { cat } from '../../test/fixtures'
import { AppStoreProvider, createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'

function makeApp(): AppStore {
  const db: Database = {
    events: createMemoryRepository<EventRecord>(),
    categories: createMemoryRepository<Category>(),
    tags: createMemoryRepository<Tag>(),
  }
  const clock: Clock = { now: () => 't1' }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day' })
}

// MoveMenu renders inside the provider tree in the real app (it calls useT()
// for the folder-quote formatting), so its tests need an AppStoreProvider too.
function renderMenu(el: ReactElement, app: AppStore = makeApp()) {
  return render(<AppStoreProvider value={app}>{el}</AppStoreProvider>)
}

describe('MoveMenu', () => {
  it('renders 顶级 plus a menuitem per target and reports the chosen parent', async () => {
    const onMove = vi.fn()
    const targets = [
      { category: cat({ id: 'a', name: 'A' }), depth: 0 },
      { category: cat({ id: 'b', name: 'B' }), depth: 1 },
    ]
    renderMenu(<MoveMenu targets={targets} onMove={onMove} />)
    await userEvent.click(screen.getByRole('menuitem', { name: '顶级' }))
    expect(onMove).toHaveBeenCalledWith(null)
    await userEvent.click(screen.getByRole('menuitem', { name: /「B」/ }))
    expect(onMove).toHaveBeenCalledWith('b')
  })

  it('uses a custom topLabel when given, defaulting to 顶级', async () => {
    const onMove = vi.fn()
    const targets = [{ category: cat({ id: 'a', name: 'A' }), depth: 0 }]
    const app = makeApp()
    const { rerender } = renderMenu(<MoveMenu targets={targets} onMove={onMove} />, app)
    expect(screen.getByRole('menuitem', { name: '顶级' })).toBeTruthy()
    rerender(
      <AppStoreProvider value={app}>
        <MoveMenu targets={targets} onMove={onMove} topLabel="未分类" />
      </AppStoreProvider>,
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '未分类' }))
    expect(onMove).toHaveBeenCalledWith(null)
  })
})
