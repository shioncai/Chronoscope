import type { Theme, ThemeMode } from './types'

export const THEME_STORAGE_KEY = 'chronoscope.theme'

/** The stored choice, if it is one; anything else (nothing yet, an old or
 *  garbled value) means "follow the system". */
export function resolveInitialThemeMode(stored: string | null): ThemeMode {
  return stored === 'day' || stored === 'night' || stored === 'system' ? stored : 'system'
}

/** Decide what a mode paints, given what the OS prefers right now. */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): Theme {
  if (mode === 'system') return systemPrefersDark ? 'night' : 'day'
  return mode
}

export function resolveInitialTheme(stored: string | null, systemPrefersDark: boolean): Theme {
  return resolveTheme(resolveInitialThemeMode(stored), systemPrefersDark)
}

export function loadStoredTheme(storage: Pick<Storage, 'getItem'>): string | null {
  return storage.getItem(THEME_STORAGE_KEY)
}

export function persistTheme(storage: Pick<Storage, 'setItem'>, mode: ThemeMode): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // blocked storage: the choice lasts for this session only
  }
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
