// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useBackHandler } from './useBackHandler'
import { runTopBackHandler, backHandlerCount } from '../../platform'

function Layer({ active, onBack }: { active: boolean; onBack: () => void }) {
  useBackHandler(active, onBack)
  return null
}

describe('useBackHandler', () => {
  it('registers only while active', () => {
    const before = backHandlerCount()
    const { rerender, unmount } = render(<Layer active={false} onBack={() => {}} />)
    expect(backHandlerCount()).toBe(before)

    rerender(<Layer active onBack={() => {}} />)
    expect(backHandlerCount()).toBe(before + 1)

    unmount()
    expect(backHandlerCount()).toBe(before)
  })

  it('runs the latest callback, without re-registering on every render', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender, unmount } = render(<Layer active onBack={first} />)
    const registered = backHandlerCount()

    rerender(<Layer active onBack={second} />)
    expect(backHandlerCount()).toBe(registered)

    runTopBackHandler()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()

    unmount()
  })
})
