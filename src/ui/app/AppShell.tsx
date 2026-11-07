import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { AppStoreProvider, useAppState, applyTheme, applyThemeColor, persistTheme, applyLocale, persistLocale, type AppStore } from '../../state'
import { TopBar } from './TopBar'
import { Sidebar } from '../sidebar/Sidebar'
import { ListView } from '../list/ListView'
import { TimelineView } from '../timeline/TimelineView'
import { EventEditor } from '../editor/EventEditor'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useBackHandler } from '../hooks/useBackHandler'
import type { Id } from '../../domain/model'
import { useT } from '../../i18n/useT'

type EditorTarget = Id | 'new' | null

// Adjustable sidebar width, persisted across sessions. The sidebar's left edge
// sits at viewport x=0, so a drag's clientX is the desired width directly.
const SB_KEY = 'cs.sidebarWidth'
const SB_MIN = 200
const SB_MAX = 460
const SB_DEFAULT = 248
const clampWidth = (n: number) => Math.max(SB_MIN, Math.min(SB_MAX, n))
function loadSidebarWidth(): number {
  if (typeof window === 'undefined') return SB_DEFAULT
  const v = Number(window.localStorage.getItem(SB_KEY))
  return Number.isFinite(v) && v > 0 ? clampWidth(v) : SB_DEFAULT
}

function ShellBody() {
  const state = useAppState()
  const t = useT()
  const [editor, setEditor] = useState<EditorTarget>(null)
  const trapRef = useFocusTrap<HTMLDivElement>(editor !== null, () => setEditor(null))
  const shellRef = useRef<HTMLDivElement>(null)
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth)

  // Drive the width via a CSS variable imperatively during the drag so the heavy
  // list/timeline views don't re-render on every pointer move; commit to state +
  // localStorage only on release.
  const startResize = (e: ReactPointerEvent) => {
    e.preventDefault()
    const move = (ev: PointerEvent) => {
      shellRef.current?.style.setProperty('--sidebar-w', `${clampWidth(ev.clientX)}px`)
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      const w = clampWidth(ev.clientX)
      setSidebarWidth(w)
      try {
        window.localStorage.setItem(SB_KEY, String(w))
      } catch {
        /* storage unavailable — keep the in-memory width */
      }
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  // The sidebar can be collapsed/expanded at any width. Default it open on a
  // desktop-width viewport and closed on a narrow one (where it's an overlay
  // drawer). matchMedia is absent in jsdom → fall back to closed for tests.
  const [sidebarOpen, setSidebarOpen] = useState(
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(min-width: 641px)').matches
        : false,
  )

  // Below any modal in the stack: back closes the topmost modal first, and only
  // once they're all gone does it close the drawer.
  useBackHandler(sidebarOpen, () => setSidebarOpen(false))

  // the batch bar is up (it renders only for a non-empty selection, and only in
  // the list)
  const batchActive = state.view === 'list' && state.checkedIds.length > 0

  // useLayoutEffect (not useEffect): the DOM `data-theme` must be set during the
  // commit phase, before TimelineView's passive draw effect reads the CSS
  // variables via getComputedStyle. With a passive effect here the canvas
  // repaints with the old theme's colors and only catches up on the next
  // interaction.
  useLayoutEffect(() => {
    applyTheme(document.documentElement, state.theme)
    applyThemeColor(Array.from(document.querySelectorAll('meta[name="theme-color"]')), state.theme)
    persistTheme(window.localStorage, state.theme)
  }, [state.theme])

  useLayoutEffect(() => {
    applyLocale(document.documentElement, state.locale)
    persistLocale(window.localStorage, state.locale)
  }, [state.locale])

  return (
    <div className="app-shell" ref={shellRef} style={{ '--sidebar-w': `${sidebarWidth}px` } as CSSProperties}>
      <TopBar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className="body">
        <Sidebar open={sidebarOpen} onResizeStart={startResize} onEdit={(id) => setEditor(id)} />
        <main className="view-area">
          {state.view === 'list' ? (
            <ListView onEdit={(id) => setEditor(id)} />
          ) : (
            <TimelineView onEdit={(id) => setEditor(id)} />
          )}
        </main>
        {sidebarOpen && <div className="drawer-backdrop" onClick={() => setSidebarOpen(false)} />}
        {/* FAB lives on the non-scrolling .body (not inside .view-area), so its
            position is identical in both views and it never scrolls with the
            list or shifts with the list's scrollbar.

            It stands down while rows are checked: that is the batch bar's space,
            and on a phone the bar needs two rows to fit its actions. "Add an
            event" is also not what the hand is reaching for mid-selection. */}
        {!batchActive && (
          <button type="button" className="fab" aria-label={t('common.newEvent')} onClick={() => setEditor('new')}>
            <span aria-hidden="true">＋</span>
          </button>
        )}
      </div>
      {editor !== null && (
        <div className="modal-overlay" onClick={() => setEditor(null)}>
          <div className="modal" ref={trapRef} aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <EventEditor editingId={editor === 'new' ? null : editor} onClose={() => setEditor(null)} />
          </div>
        </div>
      )}
    </div>
  )
}

export interface AppShellProps {
  app: AppStore
}

export function AppShell({ app }: AppShellProps) {
  return (
    <AppStoreProvider value={app}>
      <ShellBody />
    </AppStoreProvider>
  )
}
