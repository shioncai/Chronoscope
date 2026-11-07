// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { AppStoreProvider, useAppSelector } from './context'
import { createAppStore } from './appStore'
import { createMemoryRepository } from '../data'
import type { EventRecord, Category, Tag } from '../domain/model'

describe('useAppSelector', () => {
  it('re-renders only when the selected slice changes', () => {
    const app = createAppStore({
      db: { events: createMemoryRepository<EventRecord>(), categories: createMemoryRepository<Category>(), tags: createMemoryRepository<Tag>() },
      clock: { now: () => 't' },
      nowYear: 2026,
      theme: 'day',
    })
    let renders = 0
    function Probe() {
      renders++
      const view = useAppSelector((s) => s.view)
      return <span>{view}</span>
    }
    const { container } = render(<AppStoreProvider value={app}><Probe /></AppStoreProvider>)
    expect(container.textContent).toBe('list')
    const before = renders
    act(() => app.setTimelineView({ min: 0, max: 1 })) // unrelated slice
    expect(renders).toBe(before)
    act(() => app.setView('timeline'))
    expect(container.textContent).toBe('timeline')
    expect(renders).toBe(before + 1)
  })
})
