// src/ui/features/markdown/text.ts
import { renderMarkdown } from './render'

// A one-line plain-text projection of a Markdown note, for dense contexts like
// the list view's 备注 column where rendering block elements (headings, lists,
// tables) would blow up the row. We render through micromark first so every
// syntax is handled consistently, then strip tags and collapse whitespace.
// The HTML is already sanitized by renderMarkdown (no raw HTML), so tag removal
// only ever sees the safe elements micromark emits.
export function markdownToText(src: string): string {
  if (!src) return ''
  return renderMarkdown(src)
    // micromark separates block elements with newlines, so dropping tags
    // outright keeps blocks apart (via those newlines) without wedging spaces
    // between inline runs — important for space-free scripts like Chinese.
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/&amp;/g, '&') // decode ampersand last to avoid double-decoding
    .replace(/\s+/g, ' ')
    .trim()
}
