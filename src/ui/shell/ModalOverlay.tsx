import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * The backdrop every modal sits on — always mounted on the body, never where it
 * happened to be rendered.
 *
 * A modal belongs to the viewport. But `position: fixed` does NOT resolve against
 * the viewport when any ancestor carries a `transform`: that ancestor becomes the
 * containing block instead. On a phone the sidebar is exactly such an element (it
 * slides in on `translateX`), so About — rendered from the sidebar's footer —
 * centred itself on the drawer rather than the screen. The colour popover was
 * caught by the same trap and portalled out; this makes it a rule rather than a
 * lesson each modal has to learn.
 */
export function ModalOverlay({
  center = false,
  onClose,
  children,
}: {
  center?: boolean
  onClose: () => void
  children: ReactNode
}) {
  return createPortal(
    <div className={center ? 'modal-overlay modal-overlay--center' : 'modal-overlay'} onClick={onClose}>
      {children}
    </div>,
    document.body,
  )
}
