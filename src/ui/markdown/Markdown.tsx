// src/ui/features/markdown/Markdown.tsx
import { renderMarkdown } from './render'

export function Markdown({ source }: { source: string }) {
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />
}
