// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEventMove } from './useEventMove'
import { AppStoreProvider, createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag, Id } from '../../domain/model'

function makeApp(): AppStore {
  const db: Database = { events: createMemoryRepository<EventRecord>(), categories: createMemoryRepository<Category>(), tags: createMemoryRepository<Tag>() }
  let t = 0, i = 0; const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => `id${++i}` })
}
let app: AppStore
beforeEach(() => { app = makeApp() })

function Harness({ ids, target }: { ids: Id[]; target: Id | null }) {
  const { move, dialog } = useEventMove()
  return (
    <>
      <button onClick={() => move(ids, target)}>go</button>
      {dialog}
    </>
  )
}

describe('useEventMove', () => {
  it('moves an event with no conflict immediately', async () => {
    const a = await app.createCategory({ name: 'A' })
    const b = await app.createCategory({ name: 'B' })
    const e = await app.createEvent({ title: 'x', categoryId: a })
    render(<AppStoreProvider value={app}><Harness ids={[e]} target={b} /></AppStoreProvider>)
    await userEvent.click(screen.getByText('go'))
    expect(app.store.getState().events.find((x) => x.id === e)?.categoryId).toBe(b)
  })

  it('opens the conflict dialog on a same-title collision; overwrite wins', async () => {
    const a = await app.createCategory({ name: 'A' })
    const b = await app.createCategory({ name: 'B' })
    const mover = await app.createEvent({ title: '登月', categoryId: a })
    const occupant = await app.createEvent({ title: '登月', categoryId: b })
    render(<AppStoreProvider value={app}><Harness ids={[mover]} target={b} /></AppStoreProvider>)
    await userEvent.click(screen.getByText('go'))
    await userEvent.click(screen.getByText('全部覆盖'))
    await userEvent.click(screen.getByText('确认'))
    expect(app.store.getState().events.find((x) => x.id === mover)?.categoryId).toBe(b)
    expect(app.store.getState().events.find((x) => x.id === occupant)).toBeUndefined() // purged
  })
})
