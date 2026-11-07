// src/ui/features/markdown/render.ts
import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'

// micromark defaults are safe for single-user note content: raw HTML is
// omitted (allowDangerousHtml is off) and dangerous link protocols like
// javascript: are dropped (allowDangerousProtocol is off) — so we render
// without bundling a separate sanitizer. ESM-native, so no CJS interop.
//
// GFM adds the extras people expect from "Markdown": strikethrough (~~x~~),
// tables, task lists and autolink literals. It stays safe — it never enables
// raw HTML, and its tagfilter is moot while allowDangerousHtml is off.
export function renderMarkdown(src: string): string {
  if (!src) return ''
  return micromark(src, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  })
}
