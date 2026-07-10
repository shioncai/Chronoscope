// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeInput } from './TimeInput'
import { fromYear, fromCivil, fromAgo } from '../../domain/time'
import { AppStoreProvider, createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'

function makeApp(): AppStore {
  const db: Database = {
    events: createMemoryRepository<EventRecord>(),
    categories: createMemoryRepository<Category>(),
    tags: createMemoryRepository<Tag>(),
  }
  let t = 0, i = 0
  const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}

let app: AppStore
beforeEach(() => {
  app = makeApp()
})

function renderInput(props: Parameters<typeof TimeInput>[0]) {
  return render(
    <AppStoreProvider value={app}>
      <TimeInput {...props} />
    </AppStoreProvider>,
  )
}

describe('TimeInput (structured)', () => {
  it('has no free-text field — entry is all dropdowns + numbers', () => {
    renderInput({ label: '起点', value: null, onChange: vi.fn() })
    expect(screen.queryByPlaceholderText(/公元前3000年/)).toBeNull()
  })

  it('civil: a year alone emits year precision with a preview', async () => {
    const onChange = vi.fn()
    renderInput({ label: '起点', value: null, onChange })
    await userEvent.type(screen.getByLabelText('起点 年'), '1969')
    expect(onChange).toHaveBeenLastCalledWith(fromYear(1969, 'year'))
    expect(screen.getByText('1969年')).toBeTruthy()
  })

  it('civil: 公元前 maps to BCE astronomical year', async () => {
    const onChange = vi.fn()
    renderInput({ label: '起点', value: null, onChange })
    await userEvent.selectOptions(screen.getByLabelText('起点 纪元'), 'BCE')
    await userEvent.type(screen.getByLabelText('起点 年'), '3000')
    expect(onChange).toHaveBeenLastCalledWith(fromYear(-2999, 'year'))
    expect(screen.getByText('公元前3000年')).toBeTruthy()
  })

  it('civil: adding a month auto-detects month precision', async () => {
    const onChange = vi.fn()
    renderInput({ label: '起点', value: null, onChange })
    await userEvent.type(screen.getByLabelText('起点 年'), '2026')
    await userEvent.selectOptions(screen.getByLabelText('起点 月'), '6')
    expect(onChange).toHaveBeenLastCalledWith(fromCivil({ y: 2026, mo: 6 }, 'month'))
  })

  it('civil: down to the minute auto-detects minute precision', async () => {
    const onChange = vi.fn()
    renderInput({ label: '起点', value: null, onChange })
    await userEvent.type(screen.getByLabelText('起点 年'), '2026')
    await userEvent.selectOptions(screen.getByLabelText('起点 月'), '6')
    await userEvent.selectOptions(screen.getByLabelText('起点 日'), '21')
    await userEvent.selectOptions(screen.getByLabelText('起点 时'), '15')
    await userEvent.selectOptions(screen.getByLabelText('起点 分'), '30')
    expect(onChange).toHaveBeenLastCalledWith(fromCivil({ y: 2026, mo: 6, d: 21, h: 15, mi: 30 }, 'minute'))
    expect(screen.getByText('2026-06-21 15:30')).toBeTruthy()
  })

  it('switches to 大尺度 via the segmented control', async () => {
    renderInput({ label: '起点', value: null, onChange: () => {} })
    await userEvent.click(screen.getByRole('button', { name: '大尺度' }))
    expect(screen.getByLabelText('起点 单位')).toBeTruthy()
  })

  it('scale: 大尺度 + 十亿年 + 距今 emits a Ga point', async () => {
    const onChange = vi.fn()
    renderInput({ label: '起点', value: null, onChange })
    await userEvent.click(screen.getByRole('button', { name: '大尺度' }))
    await userEvent.selectOptions(screen.getByLabelText('起点 单位'), 'Ga')
    await userEvent.type(screen.getByLabelText('起点 距今'), '3.8')
    expect(onChange).toHaveBeenLastCalledWith(fromAgo(3.8e9, 'Ga'))
    expect(screen.getByText('约38.0亿年前')).toBeTruthy()
  })

  it('seeds its fields from an existing value when editing', () => {
    renderInput({ label: '起点', value: fromCivil({ y: 2026, mo: 6, d: 21 }, 'day'), onChange: vi.fn() })
    expect((screen.getByLabelText('起点 年') as HTMLInputElement).value).toBe('2026')
    expect((screen.getByLabelText('起点 月') as HTMLSelectElement).value).toBe('6')
    expect((screen.getByLabelText('起点 日') as HTMLSelectElement).value).toBe('21')
    expect(screen.getByText('2026-06-21')).toBeTruthy()
  })
})
