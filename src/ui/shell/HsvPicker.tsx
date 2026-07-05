import { useEffect, useRef, useState } from 'react'
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from '../color/hsv'

export interface HsvPickerProps {
  value: string
  onChange: (hex: string) => void
  onCommit: (hex: string) => void
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

export function HsvPicker({ value, onChange, onCommit }: HsvPickerProps) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value))
  const [hexText, setHexText] = useState(value)
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setHsv(hexToHsv(value)); setHexText(value) }, [value])

  const current = hsvToHex(hsv)

  const emit = (next: Hsv) => {
    setHsv(next)
    const hex = hsvToHex(next)
    setHexText(hex)
    onChange(hex)
  }

  const onSv = (e: React.PointerEvent) => {
    const el = svRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    emit({ ...hsv, s: clamp01((e.clientX - r.left) / r.width), v: clamp01(1 - (e.clientY - r.top) / r.height) })
  }
  const onHue = (e: React.PointerEvent) => {
    const el = hueRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const r = el.getBoundingClientRect()
    if (r.width === 0) return
    emit({ ...hsv, h: clamp01((e.clientX - r.left) / r.width) * 360 })
  }
  const onHex = (raw: string) => {
    setHexText(raw)
    const n = normalizeHex(raw)
    if (n) { setHsv(hexToHsv(n)); onChange(n) }
  }
  const commit = () => onCommit(normalizeHex(hexText) ?? current)

  return (
    <div className="hsv-picker">
      <div className="hsv-sv" ref={svRef} style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }}
        onPointerDown={onSv} onPointerMove={(e) => { if (e.buttons === 1) onSv(e) }}>
        <span className="hsv-sv-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </div>
      <div className="hsv-hue" ref={hueRef}
        onPointerDown={onHue} onPointerMove={(e) => { if (e.buttons === 1) onHue(e) }}>
        <span className="hsv-hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>
      <div className="hsv-row">
        <span className="hsv-preview" style={{ background: current }} />
        <input className="hsv-hex" aria-label="十六进制颜色" value={hexText}
          onChange={(e) => onHex(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit() }} />
        <button type="button" className="hsv-add" onClick={commit}>加入</button>
      </div>
    </div>
  )
}
