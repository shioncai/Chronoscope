import type { Theme } from './types'

export const THEME_STORAGE_KEY = 'chronoscope.theme'

export function resolveInitialTheme(stored: string | null, systemPrefersDark: boolean): Theme {
  if (stored === 'day' || stored === 'night') return stored
  return systemPrefersDark ? 'night' : 'day'
}

export function loadStoredTheme(storage: Pick<Storage, 'getItem'>): string | null {
  return storage.getItem(THEME_STORAGE_KEY)
}

export function persistTheme(storage: Pick<Storage, 'setItem'>, theme: Theme): void {
  storage.setItem(THEME_STORAGE_KEY, theme)
}

export function applyTheme(root: { setAttribute(name: string, value: string): void }, theme: Theme): void {
  root.setAttribute('data-theme', theme)
}

/* The colour the browser paints its address bar / status bar with, and the one
   Electron paints the window with before the renderer's first frame. Mirrors
   --bg in ui/styles/tokens.css — see the sync note at the top of that file. */
export const THEME_COLORS: Record<Theme, string> = {
  day: '#f0efec',
  night: '#121211',
}

/* index.html ships a media-scoped pair of <meta name="theme-color"> tags so the
   browser gets the colour right before React mounts. Once the store knows the
   active theme — which may be a manual override that contradicts the system —
   collapse every tag onto that one colour, so the media queries stop deciding. */
export function applyThemeColor(
  metas: readonly { setAttribute(name: string, value: string): void }[],
  theme: Theme,
): void {
  for (const meta of metas) meta.setAttribute('content', THEME_COLORS[theme])
}
