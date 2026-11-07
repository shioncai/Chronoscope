import type { ReactNode } from 'react'

/** Wrap each case-insensitive occurrence of `q` in <mark>. */
export function highlight(text: string, q: string): ReactNode {
  const needle = q.trim().toLowerCase()
  if (!needle) return text
  const lower = text.toLowerCase()
  const out: ReactNode[] = []
  let at = 0
  for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, at)) {
    if (i > at) out.push(text.slice(at, i))
    out.push(<mark key={i}>{text.slice(i, i + needle.length)}</mark>)
    at = i + needle.length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}
