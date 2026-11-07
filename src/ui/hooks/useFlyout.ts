import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'
import { positionFlyout, type Rect } from '../components/positionFlyout'

type Anchor = RefObject<HTMLElement | null> | Rect

function resolve(anchor: Anchor): Rect {
  if ('current' in anchor) {
    const el = anchor.current
    if (!el) return { left: 0, top: 0, width: 0, height: 0 }
    const r = el.getBoundingClientRect()
    return { left: r.left, top: r.top, width: r.width, height: r.height }
  }
  return anchor
}

export function useFlyout(
  anchor: Anchor,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' })
  useLayoutEffect(() => {
    if (!open) return
    const compute = () => {
      const panel = panelRef.current
      const size = { width: panel?.offsetWidth ?? 0, height: panel?.offsetHeight ?? 0 }
      const { left, top } = positionFlyout(resolve(anchor), size, { width: window.innerWidth, height: window.innerHeight })
      // Bail out when unchanged: consumers pass a fresh Rect/ref each render, so
      // returning the same reference avoids a re-render → recompute loop.
      setStyle((prev) =>
        prev.left === left && prev.top === top && prev.visibility === 'visible'
          ? prev
          : { position: 'fixed', left, top, visibility: 'visible', zIndex: 50 })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [open, anchor, panelRef])
  return style
}
