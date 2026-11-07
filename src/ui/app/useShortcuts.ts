import { useEffect, useRef } from 'react'

/** True when a key press belongs to a text field rather than to the app. */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  if (t.isContentEditable) return true
  const tag = t.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (t as HTMLInputElement).type
  return !['checkbox', 'radio', 'button', 'submit', 'range', 'color'].includes(type)
}

/** A modal owns the keyboard while it is open. */
export const modalOpen = (): boolean => document.querySelector('[aria-modal="true"]') != null

export interface KeyHandlers {
  [combo: string]: (e: KeyboardEvent) => void
}

/**
 * Bind app-level keys on the window. Combos are written "mod+z", "shift+mod+z",
 * "?", "n" — "mod" is Ctrl, or ⌘ on a Mac. Single keys are ignored while
 * typing or while a modal is up; mod combos are ignored while typing, so a
 * text field keeps its own undo.
 */
export function useKeys(handlers: KeyHandlers, enabled = true): void {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const combo = `${e.shiftKey && (mod || e.key.length > 1) ? 'shift+' : ''}${mod ? 'mod+' : ''}${key}`
      const fn = ref.current[combo] ?? (e.key.length === 1 && !mod ? ref.current[e.key] : undefined)
      if (!fn) return
      if (isTypingTarget(e.target)) return
      if (!mod && (e.altKey || modalOpen())) return
      e.preventDefault()
      fn(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
