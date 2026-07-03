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
