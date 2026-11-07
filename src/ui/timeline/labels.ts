// Pure label geometry for the timeline. No DOM/canvas: the label font is
// monospace, so widths are analytic and run identically in prod and tests.

export const BASE_FONT_PX = 11
export const LABEL_GAP = 6 // px between a glyph core and its label

// Per-codepoint advance in em. CJK / Hangul / full-width forms render ~1em in a
// monospace face; other (Latin/ASCII) glyphs ~0.6em. Slightly generous so the
// row packing never under-reserves and lets labels touch.
function charEm(cp: number): number {
  const wide =
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK radicals … Yi
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compat forms
    (cp >= 0xff00 && cp <= 0xff60) || // full-width forms
    (cp >= 0xffe0 && cp <= 0xffe6)
  return wide ? 1 : 0.6
}

export function labelWidth(text: string, fontSizePx: number): number {
  let em = 0
  for (const ch of text) em += charEm(ch.codePointAt(0)!)
  return em * fontSizePx
}

// Trim `text` to fit `maxPx`, appending '…'. Returns '' when not even '…' fits.
export function truncateToWidth(text: string, maxPx: number, fontSizePx: number): string {
  if (labelWidth(text, fontSizePx) <= maxPx) return text
  const ellW = labelWidth('…', fontSizePx)
  if (ellW > maxPx) return ''
  let out = ''
  let w = ellW
  for (const ch of text) {
    const cw = labelWidth(ch, fontSizePx)
    if (w + cw > maxPx) break
    out += ch
    w += cw
  }
  return out + '…'
}

export interface LabelPlacement {
  text: string // display text, possibly truncated; '' when dropped
  side: 'left' | 'right' | 'none'
  x: number // draw anchor: right→textAlign 'left' start; left→textAlign 'right' end
  occLeft: number // occupied interval (core + label) for row packing
  occRight: number
}

// Choose a side for a glyph's label so it never crosses either viewport edge,
// truncating (…) onto the roomier side when the full label fits neither, and
// returning the occupied interval the row packer reserves.
export function placeLabel(args: {
  coreLeft: number
  coreRight: number
  text: string
  fontSizePx: number
  canvasWidth: number
}): LabelPlacement {
  const { coreLeft, coreRight, text, fontSizePx, canvasWidth } = args
  const w = labelWidth(text, fontSizePx)

  // 1. prefer right if the full label fits
  if (coreRight + LABEL_GAP + w <= canvasWidth) {
    return { text, side: 'right', x: coreRight + LABEL_GAP, occLeft: coreLeft, occRight: coreRight + LABEL_GAP + w }
  }
  // 2. else left if the full label fits without crossing the left edge
  if (coreLeft - LABEL_GAP - w >= 0) {
    return { text, side: 'left', x: coreLeft - LABEL_GAP, occLeft: coreLeft - LABEL_GAP - w, occRight: coreRight }
  }
  // 3. neither fits — truncate onto whichever side has more room
  const rightRoom = canvasWidth - (coreRight + LABEL_GAP)
  const leftRoom = coreLeft - LABEL_GAP
  const dropped: LabelPlacement = { text: '', side: 'none', x: 0, occLeft: coreLeft, occRight: coreRight }
  if (rightRoom >= leftRoom) {
    const t = truncateToWidth(text, rightRoom, fontSizePx)
    if (t === '') return dropped
    return { text: t, side: 'right', x: coreRight + LABEL_GAP, occLeft: coreLeft, occRight: coreRight + LABEL_GAP + labelWidth(t, fontSizePx) }
  }
  const t = truncateToWidth(text, leftRoom, fontSizePx)
  if (t === '') return dropped
  return { text: t, side: 'left', x: coreLeft - LABEL_GAP, occLeft: coreLeft - LABEL_GAP - labelWidth(t, fontSizePx), occRight: coreRight }
}

/** Where the "now" chip sits in the tick row: centred on the present, kept
 *  inside the canvas. Scene (to clear tick labels from under it) and renderer
 *  (to paint it) share this so they agree to the pixel. */
export function nowChipSpan(nowX: number, text: string, fontSizePx: number, canvasWidth: number) {
  const pad = 4
  const w = labelWidth(text, fontSizePx)
  const textX = Math.max(2 + pad, Math.min(nowX - w / 2, canvasWidth - w - 2 - pad))
  return { x0: textX - pad, x1: textX + w + pad, textX }
}
