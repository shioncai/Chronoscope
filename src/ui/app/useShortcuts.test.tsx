// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { useKeys, isTypingTarget, type KeyHandlers } from './useShortcuts'
import { historyLabel } from './historyLabel'

function Keys({ handlers }: { handlers: KeyHandlers }) {
  useKeys(handlers)
  return <input aria-label="field" />
}

afterEach(cleanup)

describe('useKeys', () => {
  it('matches mod combos with Ctrl or ⌘, and shift+mod separately', () => {
    const undo = vi.fn()
    const redo = vi.fn()
    render(<Keys handlers={{ 'mod+z': undo, 'shift+mod+z': redo }} />)
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'Z', metaKey: true, shiftKey: true })
    expect(undo).toHaveBeenCalledTimes(1)
    expect(redo).toHaveBeenCalledTimes(1)
  })
  it('matches a shifted symbol by the character it types', () => {
    const help = vi.fn()
    render(<Keys handlers={{ '?': help }} />)
    fireEvent.keyDown(window, { key: '?', shiftKey: true })
    expect(help).toHaveBeenCalledTimes(1)
  })
  it('leaves keys alone while typing in a field', () => {
    const n = vi.fn()
    const undo = vi.fn()
    const { getByLabelText } = render(<Keys handlers={{ n, 'mod+z': undo }} />)
    const field = getByLabelText('field')
    fireEvent.keyDown(field, { key: 'n' })
    fireEvent.keyDown(field, { key: 'z', ctrlKey: true }) // the field's own undo
    expect(n).not.toHaveBeenCalled()
    expect(undo).not.toHaveBeenCalled()
  })
  it('ignores single keys while a modal is open, but still honours mod combos', () => {
    const n = vi.fn()
    const undo = vi.fn()
    render(<Keys handlers={{ n, 'mod+z': undo }} />)
    const modal = document.createElement('div')
    modal.setAttribute('aria-modal', 'true')
    document.body.appendChild(modal)
    fireEvent.keyDown(window, { key: 'n' })
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(n).not.toHaveBeenCalled()
    expect(undo).toHaveBeenCalledTimes(1)
    modal.remove()
  })
})

describe('isTypingTarget', () => {
  it('counts text inputs, textareas and selects, not checkboxes or buttons', () => {
    const el = (html: string) => {
      const d = document.createElement('div')
      d.innerHTML = html
      return d.firstElementChild
    }
    expect(isTypingTarget(el('<input type="text">'))).toBe(true)
    expect(isTypingTarget(el('<input type="search">'))).toBe(true)
    expect(isTypingTarget(el('<textarea></textarea>'))).toBe(true)
    expect(isTypingTarget(el('<select></select>'))).toBe(true)
    expect(isTypingTarget(el('<input type="checkbox">'))).toBe(false)
    expect(isTypingTarget(el('<button></button>'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('historyLabel', () => {
  it('names an undo step in either language, with the right plural', () => {
    expect(historyLabel('en', { action: 'event.delete', count: 3 })).toBe('Delete 3 events')
    expect(historyLabel('en', { action: 'event.delete', count: 1 })).toBe('Delete 1 event')
    expect(historyLabel('zh', { action: 'event.delete', count: 3 })).toBe('删除 3 个事件')
  })
})
