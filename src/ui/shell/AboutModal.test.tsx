// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AboutModal } from './AboutModal'
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

function renderModal(onClose: () => void, app: AppStore = makeApp()) {
  return render(
    <AppStoreProvider value={app}>
      <AboutModal onClose={onClose} />
    </AppStoreProvider>,
  )
}

describe('AboutModal', () => {
  it('renders app name and closes on the close button', async () => {
    const onClose = vi.fn()
    renderModal(onClose)
    expect(screen.getByText('Chronoscope')).toBeTruthy()
    expect(screen.getByText(/本地优先/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('centers its overlay via the modal-overlay--center modifier', () => {
    const { container } = renderModal(() => {})
    const overlay = container.querySelector('.modal-overlay')
    expect(overlay?.classList.contains('modal-overlay--center')).toBe(true)
  })

  it('renders in English after switching locale', () => {
    const app = makeApp()
    app.setLocale('en')
    renderModal(() => {}, app)
    expect(screen.getByText(/Local-first/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})
