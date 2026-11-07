// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventDetailCard } from './EventDetailCard'
import type { EventCardData } from './card'
import { createAppStore, type AppStore } from '../../state'
import { createMemoryRepository, type Database, type Clock } from '../../data'
import type { EventRecord, Category, Tag } from '../../domain/model'
import { TestProviders } from '../../test/providers'

const data: EventCardData = {
  id: 'a', title: '阿波罗11号', timeLabel: '1969年', note: '**首次**登月',
  categoryName: '航天', categoryPath: ['航天'], categoryColor: '#3f6fa8', tagNames: ['里程碑'], links: [{ id: 'b', title: '土星五号' }],
  duration: null, relative: null, deleted: false,
}

function makeApp(): AppStore {
  const db: Database = {
    events: createMemoryRepository<EventRecord>(),
    categories: createMemoryRepository<Category>(),
    tags: createMemoryRepository<Tag>(),
  }
  let t = 0
  const clock: Clock = { now: () => `t${++t}` }
  return createAppStore({ db, clock, nowYear: 2026, theme: 'day', genId: () => 'id' })
}

function renderCard(props: Partial<Parameters<typeof EventDetailCard>[0]> = {}) {
  const app = makeApp()
  return render(
    <TestProviders app={app}>
      <EventDetailCard data={data} onEdit={() => {}} onClose={() => {}} onSelectLink={() => {}} {...props} />
    </TestProviders>,
  )
}

describe('EventDetailCard', () => {
  it('shows title, time, category, tags, and the rendered markdown note', async () => {
    renderCard()
    expect(screen.getByText('阿波罗11号')).toBeTruthy()
    expect(screen.getByText('1969年')).toBeTruthy()
    expect(screen.getByText('航天')).toBeTruthy()
    expect(screen.getByText('# 里程碑')).toBeTruthy()
    // the markdown renderer is lazy-loaded; the plain source shows until it lands
    await waitFor(() => expect(document.querySelector('.markdown strong')?.textContent).toBe('首次'))
  })
  it('fires onSelectLink with the link id when a link button is clicked', async () => {
    let picked = ''
    renderCard({ onSelectLink: (id) => (picked = id) })
    await userEvent.click(screen.getByRole('button', { name: '土星五号' }))
    expect(picked).toBe('b')
  })
  it('fires onEdit and onClose', async () => {
    let edited = false
    let closed = false
    renderCard({ onEdit: () => (edited = true), onClose: () => (closed = true) })
    await userEvent.click(screen.getByRole('button', { name: '编辑' }))
    await userEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(edited).toBe(true)
    expect(closed).toBe(true)
  })
})
