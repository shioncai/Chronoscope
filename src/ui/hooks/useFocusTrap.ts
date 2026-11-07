import { useEffect, useRef } from 'react'
import { useBackHandler } from './useBackHandler'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap<T extends HTMLElement>(active: boolean, onEscape: () => void) {
  const ref = useRef<T>(null)
  // keep the latest onEscape in a ref (updated in an effect, not during render)
  // so the trap effect below doesn't re-run when only the callback changes
  const escRef = useRef(onEscape)
  useEffect(() => {
    escRef.current = onEscape
  })

  // Android's back button means the same thing as Escape here. Registering at
  // the trap covers every modal in the app — editor, about, import result,
  // conflict — and the stack's LIFO order reproduces the innermost-first
  // behaviour the Escape handler already has.
  useBackHandler(active, () => escRef.current())

  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const items = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
    // A dialog names its starting point with data-autofocus (the title of a new
    // event, say); otherwise focus lands on the first control. Not React's
    // autoFocus: that fires before this effect and would hide the opener we
    // hand focus back to on close.
    const start = node.querySelector<HTMLElement>('[data-autofocus]') ?? items()[0]
    ;(start ?? node).focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // stop the event from bubbling to an ancestor trap (e.g. a dialog
        // nested inside another modal): only the innermost trap should close.
        e.preventDefault()
        e.stopPropagation()
        escRef.current()
        return
      }
      if (e.key !== 'Tab') return
      // likewise keep Tab handling scoped to the innermost trap.
      e.stopPropagation()
      const focusables = items()
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [active])

  return ref
}
