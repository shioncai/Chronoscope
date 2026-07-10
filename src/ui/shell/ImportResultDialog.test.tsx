// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ImportResultDialog } from './ImportResultDialog'
import { AppStoreProvider, createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
import type { Locale } from '../../domain/locale'

function makeApp(locale?: Locale): AppStore {
  const db: Database = { events: createMemoryRepository<EventRecord>(), categories: createMemoryRepository<Category>(), tags: createMemoryRepository<Tag>() }
  let t = 0, i = 0
  return createAppStore({ db, clock: { now: () => `t${++t}` } as Clock, nowYear: 2026, theme: 'day', locale, genId: () => `id${++i}` })
}

describe('ImportResultDialog', () => {
  it('shows counts on success', () => {
    const app = makeApp()
    render(
      <AppStoreProvider value={app}>
        <ImportResultDialog
          outcome={{ ok: true, summary: { addedEvents: 2, overwrittenEvents: 1, unchangedEvents: 0, invalidEvents: 0, addedCategories: 1, reusedCategories: 0, addedTags: 0, reusedTags: 0 } }}
          onClose={vi.fn()}
        />
      </AppStoreProvider>,
    )
    expect(screen.getByText('新增事件').closest('div')?.textContent).toContain('2')
    expect(screen.getByText(/覆盖事件/).closest('div')?.textContent).toContain('1')
  })

  it('shows the error message on failure (zh default)', () => {
    const app = makeApp()
    render(
      <AppStoreProvider value={app}>
        <ImportResultDialog outcome={{ ok: false, error: 'not-chronoscope' }} onClose={vi.fn()} />
      </AppStoreProvider>,
    )
    expect(screen.getByText('这不是 Chronoscope 导出文件')).toBeTruthy()
  })

  it('shows the translated error message on failure (en)', () => {
    const app = makeApp('en')
    render(
      <AppStoreProvider value={app}>
        <ImportResultDialog outcome={{ ok: false, error: 'corrupt-json' }} onClose={vi.fn()} />
      </AppStoreProvider>,
    )
    expect(screen.getByText('The file is corrupted or not valid JSON.')).toBeTruthy()
  })
})
