// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FuzzInput } from './FuzzInput'
import { createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
import { TestProviders } from '../../test/providers'

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

function renderInput(props: Parameters<typeof FuzzInput>[0]) {
  return render(
    <TestProviders app={app}>
      <FuzzInput {...props} />
    </TestProviders>,
  )
}

describe('FuzzInput', () => {
  it('emits a symmetric range from ± (default unit 年)', async () => {
    const onChange = vi.fn()
    renderInput({ label: '起点', onChange })
    await userEvent.type(screen.getByLabelText('起点 模糊±'), '5')
    expect(onChange).toHaveBeenLastCalledWith({ before: 5, after: 5 })
  })
  it('expands to asymmetric, carrying the ± value across', async () => {
    const onChange = vi.fn()
    renderInput({ label: '起点', value: { before: 3, after: 3 }, onChange })
    await userEvent.click(screen.getByLabelText('起点 不对称'))
    const after = screen.getByLabelText('起点 模糊向后')
    await userEvent.clear(after)
    await userEvent.type(after, '9')
    expect(onChange).toHaveBeenLastCalledWith({ before: 3, after: 9 })
  })
  it('clears to undefined when emptied', async () => {
    const onChange = vi.fn()
    renderInput({ label: '起点', value: { before: 5, after: 5 }, onChange })
    await userEvent.clear(screen.getByLabelText('起点 模糊±'))
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
})
