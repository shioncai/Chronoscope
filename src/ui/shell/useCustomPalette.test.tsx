// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useCustomPalette } from './useCustomPalette'
import { loadCustomColors } from '../categoryColors'

function memoryStorage(): Storage {
  const store: Record<string, string> = {}
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = String(v) },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { for (const k of Object.keys(store)) delete store[k] },
    key: () => null, length: 0,
  } as unknown as Storage
}

function Harness({ storage }: { storage: Storage }) {
  const p = useCustomPalette(storage)
  return (
    <div>
      <span data-testid="list">{p.custom.join(',')}</span>
      <button onClick={() => p.add('#abcdef')}>add</button>
      <button onClick={() => p.replace('#abcdef', '#123456')}>replace</button>
      <button onClick={() => p.remove('#123456')}>remove</button>
    </div>
  )
}

describe('useCustomPalette', () => {
  it('adds, replaces, removes and persists', () => {
    const storage = memoryStorage()
    render(<Harness storage={storage} />)
    fireEvent.click(screen.getByText('add'))
    expect(screen.getByTestId('list').textContent).toBe('#abcdef')
    expect(loadCustomColors(storage)).toEqual(['#abcdef'])
    fireEvent.click(screen.getByText('replace'))
    expect(screen.getByTestId('list').textContent).toBe('#123456')
    fireEvent.click(screen.getByText('remove'))
    expect(screen.getByTestId('list').textContent).toBe('')
    expect(loadCustomColors(storage)).toEqual([])
  })
})
