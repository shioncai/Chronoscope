import { useEffect, useMemo, useState } from 'react'
import { loadMarkdown, loadedRenderer, type Render } from './load'

export function Markdown({ source }: { source: string }) {
  // Hold the renderer, not the HTML: the HTML is derived during render, so a
  // new source never needs an effect, and the only async step is the load.
  const [render, setRender] = useState<Render | null>(loadedRenderer)
  useEffect(() => {
    if (render) return
    let live = true
    void loadMarkdown().then((r) => live && setRender(() => r))
    return () => {
      live = false
    }
  }, [render])
  const html = useMemo(() => (render ? render(source) : null), [render, source])
  if (html === null) return <div className="markdown markdown--loading">{source}</div>
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
}
