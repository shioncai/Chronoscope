import { useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { Locale } from '../../domain/locale'
import { SUPPORTED_LOCALES } from '../../i18n/locales'
import { useFlyout } from '../hooks/useFlyout'
import { useDismiss } from '../hooks/useDismiss'

export interface LanguageMenuProps {
  anchorRef: RefObject<HTMLElement | null>
  current: Locale
  onPick: (code: Locale) => void
  onClose: () => void
}

export function LanguageMenu({ anchorRef, current, onPick, onClose }: LanguageMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const style = useFlyout(anchorRef, ref, true)
  // ignore clicks on the trigger button so toggling it doesn't double-fire
  useDismiss(ref, onClose, true, (t) => anchorRef.current?.contains(t) ?? false)
  return createPortal(
    <div className="lang-menu" ref={ref} role="menu" style={style} data-lang-flyout>
      {SUPPORTED_LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          role="menuitemradio"
          aria-checked={l.code === current}
          className={l.code === current ? 'lang-item active' : 'lang-item'}
          onClick={() => onPick(l.code)}
        >
          <span className="lang-check" aria-hidden="true">{l.code === current ? '✓' : ''}</span>
          {l.name}
        </button>
      ))}
    </div>,
    document.body,
  )
}
