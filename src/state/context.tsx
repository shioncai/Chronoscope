import { createContext, useContext, useRef, useSyncExternalStore } from 'react'
import type { AppStore } from './appStore'
import type { AppState } from './types'
import { useStore } from './useStore'

const AppStoreContext = createContext<AppStore | null>(null)

export const AppStoreProvider = AppStoreContext.Provider

export function useAppStore(): AppStore {
  const app = useContext(AppStoreContext)
  if (!app) throw new Error('useAppStore must be used within an AppStoreProvider')
  return app
}

/** The whole state. Re-renders on EVERY change — including each frame of a
 *  timeline pan — so prefer `useAppSelector` for anything that reads a slice. */
export function useAppState(): AppState {
  return useStore(useAppStore().store)
}

/** Shallow equality for selectors that return a small object of slices. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  }
  return true
}

/**
 * Subscribe to one slice of the state. The component re-renders only when the
 * selected value changes (by `isEqual`), not on every store update — this is
 * what keeps a pan of the timeline from re-rendering the sidebar, the top bar
 * and everything else that merely shares the store.
 */
export function useAppSelector<T>(
  selector: (s: AppState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const { store } = useAppStore()
  const cache = useRef<{ state: AppState; selector: (s: AppState) => T; value: T } | null>(null)
  const getSnapshot = (): T => {
    const state = store.getState()
    const c = cache.current
    if (c && c.state === state && c.selector === selector) return c.value
    const value = selector(state)
    if (c && isEqual(c.value, value)) {
      cache.current = { state, selector, value: c.value }
      return c.value
    }
    cache.current = { state, selector, value }
    return value
  }
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}
