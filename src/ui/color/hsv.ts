export interface Hsv { h: number; s: number; v: number }

export function normalizeHex(input: string): string | null {
  let s = input.trim().toLowerCase()
  if (s.startsWith('#')) s = s.slice(1)
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split('').map((c) => c + c).join('')
  if (/^[0-9a-f]{6}$/.test(s)) return '#' + s
  return null
}

export function hexToHsv(hex: string): Hsv {
  const n = normalizeHex(hex) ?? '#000000'
  const r = parseInt(n.slice(1, 3), 16) / 255
  const g = parseInt(n.slice(3, 5), 16) / 255
  const b = parseInt(n.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const seg = Math.floor(h / 60) % 6
  const rgb =
    seg === 0 ? [c, x, 0] :
    seg === 1 ? [x, c, 0] :
    seg === 2 ? [0, c, x] :
    seg === 3 ? [0, x, c] :
    seg === 4 ? [x, 0, c] :
    [c, 0, x]
  const to2 = (t: number) => Math.round((t + m) * 255).toString(16).padStart(2, '0')
  return '#' + to2(rgb[0]) + to2(rgb[1]) + to2(rgb[2])
}
