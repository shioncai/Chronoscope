import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORY_PRESET_GRID } from '../categoryColors'
import { useCustomPalette } from './useCustomPalette'
import { useDismiss } from './useDismiss'
import { useFlyout } from './useFlyout'
import { HsvPicker } from './HsvPicker'

export interface ColorPickerProps {
  value: string
  presets?: readonly (readonly string[])[]
  onPick: (hex: string) => void
  onClose: () => void
}

const insidePortal = (t: Node) =>
  (t as Element).closest?.('[data-picker-flyout]') != null ||
  (t as Element).closest?.('[data-picker-trigger]') != null

export function ColorPicker({ value, presets = CATEGORY_PRESET_GRID, onPick, onClose }: ColorPickerProps) {
  const norm = value.toLowerCase()
  const palette = useCustomPalette()
  const rootRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const hsvRef = useRef<HTMLDivElement>(null)
  const [hsvOpen, setHsvOpen] = useState(false)
  const hsvStyle = useFlyout(addRef, hsvRef, hsvOpen)

  useDismiss(rootRef, onClose, true, insidePortal)

  const swatch = (hex: string) => (
    <button key={hex} type="button"
      className={hex.toLowerCase() === norm ? 'swatch selected' : 'swatch'}
      style={{ background: hex }} aria-label={`颜色 ${hex}`}
      onClick={() => onPick(hex)} />
  )

  const commitFree = (hex: string) => { palette.add(hex); onPick(hex); setHsvOpen(false) }

  return (
    <div className="color-picker" ref={rootRef}>
      <div className="swatch-grid">
        {presets.map((row, i) => (
          <div className="swatch-row" key={i}>{row.map(swatch)}</div>
        ))}
      </div>
      <div className="swatch-row custom-row">
        {palette.custom.map(swatch)}
        <button ref={addRef} type="button" className="swatch add-custom" aria-label="自定义颜色"
          onClick={() => setHsvOpen((o) => !o)}>＋</button>
      </div>
      {hsvOpen && createPortal(
        <div ref={hsvRef} className="picker-flyout" data-picker-flyout style={hsvStyle}>
          <HsvPicker value={value} onChange={() => {}} onCommit={commitFree} />
        </div>,
        document.body,
      )}
    </div>
  )
}
