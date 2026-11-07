export type Render = (src: string) => string

let renderer: Render | null = null
let loading: Promise<Render> | null = null

/** The renderer, if it has loaded already; null until then. */
export const loadedRenderer = (): Render | null => renderer

/** The Markdown renderer is loaded on first use, not at startup: most
 *  sessions never open a note, and the parser is a sizeable share of the
 *  bundle. Once loaded it stays loaded. */
export function loadMarkdown(): Promise<Render> {
  if (renderer) return Promise.resolve(renderer)
  loading ??= import('./render').then((m) => (renderer = m.renderMarkdown))
  return loading
}
