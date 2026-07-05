// Preset folder colors (legible on both the day and night themes) plus a
// persisted, user-extensible custom palette. The custom palette is a local UI
// preference (localStorage) — not part of the exported data.

// 5 rows (light → dark) × 9 hue columns. A column is one hue's ramp, so a
// folder branch's levels can share a hue at different depths. Rendered row by
// row, this keeps the popover ~5 rows tall regardless of hue count.
export const CATEGORY_PRESET_GRID = [
  ['#f5b7b1', '#fad7a0', '#f9e79f', '#abebc6', '#a3e4d7', '#aed6f1', '#d7bde2', '#f5b7c9', '#d5dbdb'],
  ['#e6796b', '#f5b041', '#f7dc6f', '#58d68d', '#48c9b0', '#5dade2', '#af7ac5', '#ec87a5', '#a6acaf'],
  ['#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#d6336c', '#7f8c8d'],
  ['#c0392b', '#ca6f1e', '#d4ac0d', '#1e8449', '#117a65', '#1f618d', '#6c3483', '#a61e4d', '#566573'],
  ['#922b21', '#a04000', '#b7950b', '#145a32', '#0b5345', '#154360', '#4a235a', '#7d1638', '#2c3e50'],
] as const

// Mid row — 9 distinct hues for auto-assigning new top-level folders.
export const CATEGORY_PRESET_BASE: readonly string[] = CATEGORY_PRESET_GRID[2]

// Flattened (row-major) — membership checks / legacy consumers.
export const CATEGORY_PRESETS: readonly string[] = CATEGORY_PRESET_GRID.flat()

// Auto-assign a distinct hue when a top-level category is created.
export function nextPresetColor(index: number): string {
  const n = CATEGORY_PRESET_BASE.length
  return CATEGORY_PRESET_BASE[((index % n) + n) % n]
}

const STORAGE_KEY = 'chronoscope.customColors'

export function loadCustomColors(storage: Storage): string[] {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function persistCustomColors(storage: Storage, colors: string[]): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(colors))
  } catch {
    // best-effort: ignore quota / unavailable storage
  }
}

// Prepend a new color (lowercased, deduped), capped — oldest entries drop off.
export function addToPalette(list: string[], hex: string, cap = 12): string[] {
  const c = hex.toLowerCase()
  return [c, ...list.filter((x) => x.toLowerCase() !== c)].slice(0, cap)
}

export function removeFromPalette(list: string[], hex: string): string[] {
  const c = hex.toLowerCase()
  return list.filter((x) => x.toLowerCase() !== c)
}

export function replaceInPalette(list: string[], oldHex: string, next: string): string[] {
  const o = oldHex.toLowerCase()
  const n = next.toLowerCase()
  const mapped = list.map((x) => (x.toLowerCase() === o ? n : x))
  return mapped.filter((x, i) => mapped.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i)
}
