// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HsvPicker } from './HsvPicker'
import { createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
import { TestProviders } from '../../test/providers'

function makeApp(): AppStore {
  const db: Database = { events: createMemoryRepository<EventRecord>(), categories: createMemoryRepository<Category>(), tags: createMemoryRepository<Tag>() }
  let t = 0, i = 0
  const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}
let app: AppStore
beforeEach(() => { app = makeApp() })
function renderPicker(props: Parameters<typeof HsvPicker>[0]) {
  return render(<TestProviders app={app}><HsvPicker {...props} /></TestProviders>)
}

describe('HsvPicker', () => {
  it('seeds the hex field from value', () => {
    renderPicker({ value: '#2980b9', onChange: vi.fn(), onCommit: vi.fn() })
    expect((screen.getByLabelText('十六进制颜色') as HTMLInputElement).value).toBe('#2980b9')
  })
  it('emits onChange for a valid hex and commits on 加入', async () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    renderPicker({ value: '#2980b9', onChange, onCommit })
    fireEvent.change(screen.getByLabelText('十六进制颜色'), { target: { value: '#ff0000' } })
    expect(onChange).toHaveBeenCalledWith('#ff0000')
    await userEvent.click(screen.getByRole('button', { name: '加入' }))
    expect(onCommit).toHaveBeenCalledWith('#ff0000')
  })
  it('ignores an invalid hex (no onChange)', () => {
    const onChange = vi.fn()
    renderPicker({ value: '#2980b9', onChange, onCommit: vi.fn() })
    fireEvent.change(screen.getByLabelText('十六进制颜色'), { target: { value: 'zzz' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})
