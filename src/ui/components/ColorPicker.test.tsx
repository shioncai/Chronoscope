// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColorPicker } from './ColorPicker'
import { createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
import { TestProviders } from '../../test/providers'

const grid = [['#abcdef', '#123456'], ['#0d7d8c', '#8e44ad']] as const

function makeApp(): AppStore {
  const db: Database = { events: createMemoryRepository<EventRecord>(), categories: createMemoryRepository<Category>(), tags: createMemoryRepository<Tag>() }
  let t = 0, i = 0
  const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}
let app: AppStore
beforeEach(() => { window.localStorage.clear(); app = makeApp() })
function renderPicker(props: Parameters<typeof ColorPicker>[0]) {
  return render(<TestProviders app={app}><ColorPicker {...props} /></TestProviders>)
}

describe('ColorPicker', () => {
  it('renders the preset grid and calls onPick on a swatch', async () => {
    const onPick = vi.fn()
    renderPicker({ value: '#000000', presets: grid, onPick, onClose: vi.fn() })
    await userEvent.click(screen.getByLabelText('颜色 #abcdef'))
    expect(onPick).toHaveBeenCalledWith('#abcdef')
  })
  it('marks the swatch matching value as selected (case-insensitive)', () => {
    renderPicker({ value: '#ABCDEF', presets: grid, onPick: vi.fn(), onClose: vi.fn() })
    expect(screen.getByLabelText('颜色 #abcdef').className).toContain('selected')
    expect(screen.getByLabelText('颜色 #123456').className).not.toContain('selected')
  })
  it('closes on Escape', () => {
    const onClose = vi.fn()
    renderPicker({ value: '#000000', presets: grid, onPick: vi.fn(), onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
  it('opens the HSV picker from ＋', async () => {
    renderPicker({ value: '#000000', presets: grid, onPick: vi.fn(), onClose: vi.fn() })
    await userEvent.click(screen.getByLabelText('自定义颜色'))
    expect(screen.getByLabelText('十六进制颜色')).toBeTruthy()
  })

  async function seedCustom() {
    await userEvent.click(screen.getByLabelText('自定义颜色'))
    fireEvent.change(screen.getByLabelText('十六进制颜色'), { target: { value: '#ff0000' } })
    await userEvent.click(screen.getByRole('button', { name: '加入' }))
  }

  it('right-click on a custom color opens edit/delete and delete removes it', async () => {
    renderPicker({ value: '#000000', presets: grid, onPick: vi.fn(), onClose: vi.fn() })
    await seedCustom()
    fireEvent.contextMenu(screen.getByLabelText('颜色 #ff0000'))
    expect(screen.getByRole('button', { name: '删除' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.queryByLabelText('颜色 #ff0000')).toBeNull()
  })

  it('edit from the menu opens the HSV picker seeded with that color', async () => {
    renderPicker({ value: '#000000', presets: grid, onPick: vi.fn(), onClose: vi.fn() })
    await seedCustom()
    fireEvent.contextMenu(screen.getByLabelText('颜色 #ff0000'))
    await userEvent.click(screen.getByRole('button', { name: '编辑' }))
    expect((screen.getByLabelText('十六进制颜色') as HTMLInputElement).value).toBe('#ff0000')
  })
})
