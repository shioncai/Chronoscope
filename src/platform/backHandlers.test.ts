import { describe, it, expect, vi, afterEach } from 'vitest'
import { pushBackHandler, runTopBackHandler, backHandlerCount } from './backHandlers'

// The stack is module state, so each test unregisters what it pushed and the
// next one starts empty. (Draining it by calling runTopBackHandler in a loop
// would spin forever — running a handler deliberately doesn't pop it.)
let cleanups: Array<() => void> = []

function push(fn: () => void): () => void {
  const off = pushBackHandler(fn)
  cleanups.push(off)
  return off
}

afterEach(() => {
  cleanups.forEach((off) => off())
  cleanups = []
})

describe('backHandlers', () => {
  it('reports false when nothing is registered', () => {
    expect(runTopBackHandler()).toBe(false)
  })

  it('runs the most recently registered handler first', () => {
    const order: string[] = []
    push(() => order.push('drawer'))
    push(() => order.push('modal'))

    expect(runTopBackHandler()).toBe(true)
    expect(order).toEqual(['modal'])
  })

  it('does not pop the handler it ran — the layer unregisters itself on close', () => {
    const fn = vi.fn()
    push(fn)

    runTopBackHandler()
    runTopBackHandler()

    expect(fn).toHaveBeenCalledTimes(2)
    expect(backHandlerCount()).toBe(1)
  })

  it('unregisters the handler it returned, regardless of stack position', () => {
    const drawer = vi.fn()
    const modal = vi.fn()
    const offDrawer = push(drawer)
    push(modal)

    offDrawer()

    expect(backHandlerCount()).toBe(1)
    runTopBackHandler()
    expect(modal).toHaveBeenCalledTimes(1)
    expect(drawer).not.toHaveBeenCalled()
  })
})
