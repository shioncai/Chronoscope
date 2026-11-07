// A one-line plain-text projection of a Markdown note, for dense contexts like
// the list's note column, where block elements would blow up the row.
//
// This deliberately does NOT go through the Markdown renderer: it runs for
// every visible row on every render, and a regex pass is two orders of
// magnitude cheaper than a parse — and keeps the parser out of the list's
// critical path entirely (the renderer loads on demand). It only has to be
// right enough to read; the full rendering lives in the detail card.

const cache = new Map<string, string>()
const CACHE_MAX = 2000

export function markdownToText(src: string): string {
  if (!src) return ''
  const hit = cache.get(src)
  if (hit !== undefined) return hit
  const out = src
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, ' ')) // fenced code → its text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → text
    .replace(/<\/?[a-z][^>]*>/gi, '') // stray inline html
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/gm, '') // block markers
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, '') // table rules
    .replace(/\|/g, ' ')
    .replace(/(\*\*|__|~~|\*|_|`)(?=\S)([\s\S]*?\S)\1/g, '$2') // emphasis, strike, code
    .replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, '$1') // escapes
    .replace(/\s+/g, ' ')
    .trim()
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(src, out)
  return out
}
