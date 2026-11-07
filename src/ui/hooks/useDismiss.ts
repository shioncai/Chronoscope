import { useEffect, type RefObject } from 'react'

export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  active: boolean,
  ignore?: (target: Node) => boolean,
): void {
  useEffect(() => {
    if (!active) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current && ref.current.contains(t)) return
      if (ignore && ignore(t)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, onClose, active, ignore])
}
