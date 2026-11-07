import { useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useFlyout } from '../hooks/useFlyout'
import { useDismiss } from '../hooks/useDismiss'
import type { Placement } from './positionFlyout'

export interface PopoverProps {
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  /** Where to try first; falls back around the anchor when it does not fit. */
  placement?: Placement[]
  className?: string
  role?: 'menu' | 'dialog'
  label?: string
}

const BELOW: Placement[] = ['below', 'above', 'right', 'left']

/**
 * A floating panel anchored to a trigger, portalled to the body so no
 * overflow or transform ancestor can clip or re-anchor it. Closes on an
 * outside press or Escape; a click on the trigger itself is left to the
 * trigger, which toggles. As a menu, arrow keys walk its items.
 */
export function Popover({ anchorRef, onClose, children, placement = BELOW, className, role = 'menu', label }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const style = useFlyout(anchorRef, ref, true, placement)
  useDismiss(ref, onClose, true, (t) => anchorRef.current?.contains(t) ?? false)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (role !== 'menu') return
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [])
    if (items.length === 0) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    const go = (n: number) => {
      e.preventDefault()
      items[(n + items.length) % items.length].focus()
    }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(items.length - 1)
  }

  return createPortal(
    <div ref={ref} className={className ? `popover ${className}` : 'popover'} role={role} aria-label={label}
      style={style} onKeyDown={onKeyDown} data-popover>
      {children}
    </div>,
    document.body,
  )
}

export function MenuItem({ onClick, children, checked, danger, disabled }: {
  onClick: () => void
  children: ReactNode
  checked?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  const cls = ['menu-item']
  if (danger) cls.push('menu-item--danger')
  if (checked) cls.push('is-checked')
  return (
    <button type="button" role={checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={checked}
      className={cls.join(' ')} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
