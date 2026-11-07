import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AppStoreProvider,
  useAppStore,
  useAppSelector,
  applyTheme,
  applyThemeColor,
  persistTheme,
  applyLocale,
  persistLocale,
  prefsOf,
  savePrefs,
  shallowEqual,
  type AppStore,
} from '../../state'
import { decimalFromCivil } from '../../domain/time'
import type { Id } from '../../domain/model'
import { TopBar } from './TopBar'
import { FilterBar } from './FilterBar'
import { DataTransferProvider } from './DataTransfer'
import { useKeys } from './useShortcuts'
import { historyLabel } from './historyLabel'
import { Sidebar } from '../sidebar/Sidebar'
import { ListView } from '../list/ListView'
import { TimelineView } from '../timeline/TimelineView'
import { EventEditor } from '../editor/EventEditor'
import { ShortcutsDialog } from '../dialogs/ShortcutsDialog'
import { ToastProvider } from '../components/Toast'
import { useToast } from '../components/useToast'
import { ConfirmProvider } from '../components/Confirm'
import { Icon } from '../components/Icon'
import { useBackHandler } from '../hooks/useBackHandler'
import { useT, useLocale } from '../../i18n/useT'

type EditorTarget = Id | 'new' | null

// Adjustable sidebar width, persisted across sessions. The sidebar's left edge
// sits at viewport x=0, so a drag's clientX is the desired width directly.
const SB_KEY = 'cs.sidebarWidth'
const SB_MIN = 200
const SB_MAX = 460
const SB_DEFAULT = 260
const clampWidth = (n: number) => Math.max(SB_MIN, Math.min(SB_MAX, n))
function loadSidebarWidth(): number {
  try {
    const v = Number(window.localStorage.getItem(SB_KEY))
    return Number.isFinite(v) && v > 0 ? clampWidth(v) : SB_DEFAULT
  } catch {
    return SB_DEFAULT
  }
}
function storeSidebarWidth(w: number) {
  try {
    window.localStorage.setItem(SB_KEY, String(w))
  } catch {
    /* storage unavailable — keep the in-memory width */
  }
}

const wide = () => typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 721px)').matches

function nowAsYear(): number {
  const d = new Date()
  return decimalFromCivil({
    y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds(),
  })
}

/** Theme, language, view prefs and the clock: the shell's side effects. */
function useShellEffects() {
  const app = useAppStore()
  const { theme, themeMode, locale } = useAppSelector(
    (s) => ({ theme: s.theme, themeMode: s.themeMode, locale: s.locale }),
    shallowEqual,
  )
  const prefs = useAppSelector(prefsOf, (a, b) => JSON.stringify(a) === JSON.stringify(b))

  // useLayoutEffect (not useEffect): `data-theme` must be on the document
  // before the timeline's draw effect reads the CSS variables, or the canvas
  // repaints in the old theme's colours until the next interaction.
  useLayoutEffect(() => {
    applyTheme(document.documentElement, theme)
    applyThemeColor(Array.from(document.querySelectorAll('meta[name="theme-color"]')), theme)
  }, [theme])
  useEffect(() => persistTheme(window.localStorage, themeMode), [themeMode])

  // While following the system, follow it live — not only at launch.
  useEffect(() => {
    if (themeMode !== 'system' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => app.setTheme(mq.matches ? 'night' : 'day')
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [themeMode, app])

  useLayoutEffect(() => {
    applyLocale(document.documentElement, locale)
    try {
      persistLocale(window.localStorage, locale)
    } catch {
      /* blocked storage */
    }
  }, [locale])

  useEffect(() => savePrefs(window.localStorage, prefs), [prefs])

  // "Now" moves: keep the now-line and the log axis honest in a long session.
  useEffect(() => {
    const id = setInterval(() => app.setNowYear(nowAsYear()), 60_000)
    return () => clearInterval(id)
  }, [app])
}

function ShellBody() {
  const app = useAppStore()
  const t = useT()
  const locale = useLocale()
  const toast = useToast()
  const view = useAppSelector((s) => s.view)
  const batchActive = useAppSelector((s) => s.view === 'list' && s.checkedIds.length > 0)
  const [editor, setEditor] = useState<EditorTarget>(null)
  const [help, setHelp] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth)
  // Open on a desktop-width viewport, closed on a narrow one (where it is an
  // overlay drawer). matchMedia is absent in jsdom → closed in tests.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && wide())

  useShellEffects()

  // Below any modal in the stack: back closes the topmost modal first, and only
  // once they're all gone does it close the drawer.
  useBackHandler(sidebarOpen && !wide(), () => setSidebarOpen(false))

  const openEditor = useCallback((id: Id) => setEditor(id), [])
  const newEvent = useCallback(() => setEditor('new'), [])
  const closeEditor = useCallback(() => setEditor(null), [])

  const step = async (dir: 'undo' | 'redo') => {
    const info = await (dir === 'undo' ? app.undo() : app.redo())
    if (info) toast({ message: t(dir === 'undo' ? 'toast.undone' : 'toast.redone', { what: historyLabel(locale, info) }) })
  }

  useKeys({
    'mod+z': () => void step('undo'),
    'shift+mod+z': () => void step('redo'),
    'mod+y': () => void step('redo'),
    'mod+k': () => searchRef.current?.focus(),
    '/': () => searchRef.current?.focus(),
    n: newEvent,
    '?': () => setHelp(true),
    '1': () => app.setView('list'),
    '2': () => app.setView('timeline'),
    '[': () => setSidebarOpen((o) => !o),
  })

  // Drive the width via a CSS variable imperatively during the drag so the heavy
  // views don't re-render on every pointer move; commit on release.
  const startResize = (e: ReactPointerEvent) => {
    e.preventDefault()
    const move = (ev: PointerEvent) => shellRef.current?.style.setProperty('--sidebar-w', `${clampWidth(ev.clientX)}px`)
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('is-resizing')
      const w = clampWidth(ev.clientX)
      setSidebarWidth(w)
      storeSidebarWidth(w)
    }
    document.body.classList.add('is-resizing')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const nudgeWidth = (delta: number) => {
    const w = clampWidth(sidebarWidth + delta)
    setSidebarWidth(w)
    storeSidebarWidth(w)
  }

  return (
    <div className="app-shell" ref={shellRef} style={{ '--sidebar-w': `${sidebarWidth}px` } as CSSProperties}>
      <TopBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        searchRef={searchRef}
        onUndo={() => void step('undo')}
        onRedo={() => void step('redo')}
      />
      <div className="body">
        <Sidebar
          open={sidebarOpen}
          onResizeStart={startResize}
          onResizeKey={nudgeWidth}
          onEdit={openEditor}
          onHelp={() => setHelp(true)}
          onNavigate={() => !wide() && setSidebarOpen(false)}
        />
        <main className="view-area">
          <FilterBar />
          <div className="view-content">
            {view === 'list' ? <ListView onEdit={openEditor} onNew={newEvent} /> : <TimelineView onEdit={openEditor} onNew={newEvent} />}
          </div>
        </main>
        {sidebarOpen && <div className="drawer-backdrop" onClick={() => setSidebarOpen(false)} />}
        {/* The FAB stands down while rows are checked: that is the batch bar's
            space, and "add an event" is not what the hand is reaching for
            mid-selection. */}
        {!batchActive && (
          <button type="button" className="fab" aria-label={t('common.newEvent')} title={`${t('common.newEvent')} (N)`} onClick={newEvent}>
            <Icon name="plus" size={22} />
          </button>
        )}
      </div>
      {editor !== null && (
        <EventEditor
          key={editor}
          editingId={editor === 'new' ? null : editor}
          onClose={closeEditor}
          onSwitch={openEditor}
        />
      )}
      {help && <ShortcutsDialog onClose={() => setHelp(false)} />}
    </div>
  )
}

export interface AppShellProps {
  app: AppStore
}

export function AppShell({ app }: AppShellProps) {
  return (
    <AppStoreProvider value={app}>
      <ToastProvider>
        <ConfirmProvider>
          <DataTransferProvider>
            <ShellBody />
          </DataTransferProvider>
        </ConfirmProvider>
      </ToastProvider>
    </AppStoreProvider>
  )
}
