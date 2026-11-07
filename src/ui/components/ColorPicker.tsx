import { useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORY_PRESET_GRID } from '../color/categoryColors'
import { useCustomPalette } from '../hooks/useCustomPalette'
import { useDismiss } from '../hooks/useDismiss'
import { useFlyout } from '../hooks/useFlyout'
import { HsvPicker } from './HsvPicker'
import { useT } from '../../i18n/useT'

export interface ColorPickerProps {
  value: string
  presets?: readonly (readonly string[])[]
  anchorRef?: RefObject<HTMLElement | null>
  onPick: (hex: string) => void
  onClose: () => void
}

const insidePortal = (t: Node) =>
  (t as Element).closest?.('[data-picker-flyout]') != null ||
  (t as Element).closest?.('[data-picker-trigger]') != null

export function ColorPicker({ value, presets = CATEGORY_PRESET_GRID, anchorRef, onPick, onClose }: ColorPickerProps) {
  const t = useT()
  const norm = value.toLowerCase()
  const palette = useCustomPalette()
  const rootRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const hsvRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hsvOpen, setHsvOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null) // original hex being edited
  const [menu, setMenu] = useState<{ hex: string; at: { left: number; top: number } } | null>(null)

  // The popover itself is portaled to <body> and positioned against the trigger,
  // so it floats over the content and is never clipped by the sidebar's width.
  const rootStyle = useFlyout(anchorRef ?? { left: 0, top: 0, width: 0, height: 0 }, rootRef, true)
  const hsvStyle = useFlyout(addRef, hsvRef, hsvOpen)
  const menuStyle = useFlyout(
    { left: menu?.at.left ?? 0, top: menu?.at.top ?? 0, width: 0, height: 0 },
    menuRef, menu != null,
  )

  useDismiss(rootRef, onClose, true, insidePortal)

  const clearPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null } }

  const swatch = (hex: string, custom = false) => {
    const openMenu = (x: number, y: number) => setMenu({ hex, at: { left: x, top: y } })
    return (
      <button key={hex} type="button"
        className={hex.toLowerCase() === norm ? 'swatch selected' : 'swatch'}
        style={{ background: hex }} aria-label={t('color.swatchAria', { hex })}
        onClick={() => onPick(hex)}
        onContextMenu={custom ? (e) => { e.preventDefault(); openMenu(e.clientX, e.clientY) } : undefined}
        onPointerDown={custom ? (e) => { const x = e.clientX, y = e.clientY; pressTimer.current = setTimeout(() => openMenu(x, y), 500) } : undefined}
        onPointerMove={custom ? clearPress : undefined}
        onPointerUp={custom ? clearPress : undefined} />
    )
  }

  const commitFree = (hex: string) => {
    if (editing) palette.replace(editing, hex)
    else palette.add(hex)
    onPick(hex)
    setHsvOpen(false)
    setEditing(null)
  }

  return createPortal(
    <div className="color-picker" data-picker-flyout ref={rootRef} style={rootStyle}>
      <div className="swatch-grid">
        {presets.map((row, i) => (
          <div className="swatch-row" key={i}>{row.map((h) => swatch(h))}</div>
        ))}
      </div>
      <div className="swatch-row custom-row">
        {palette.custom.map((h) => swatch(h, true))}
        <button ref={addRef} type="button" className="swatch add-custom" aria-label={t('color.custom')}
          onClick={() => { setEditing(null); setMenu(null); setHsvOpen((o) => !o) }}>＋</button>
      </div>
      {hsvOpen && createPortal(
        <div ref={hsvRef} className="picker-flyout" data-picker-flyout style={hsvStyle}>
          <HsvPicker key={editing ?? value} value={editing ?? value} onChange={() => {}} onCommit={commitFree} />
        </div>,
        document.body,
      )}
      {menu && createPortal(
        <div ref={menuRef} className="picker-menu" data-picker-flyout style={menuStyle}>
          <button type="button" onClick={() => { setEditing(menu.hex); setHsvOpen(true); setMenu(null) }}>{t('common.edit')}</button>
          <button type="button" onClick={() => { palette.remove(menu.hex); setMenu(null) }}>{t('common.delete')}</button>
        </div>,
        document.body,
      )}
    </div>,
    document.body,
  )
}
