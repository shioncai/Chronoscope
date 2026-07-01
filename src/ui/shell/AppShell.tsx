import { useLayoutEffect, useState } from 'react'
import { AppStoreProvider, useAppState, applyTheme, persistTheme, type AppStore } from '../../state'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { ListView } from '../list/ListView'
import { TimelineView } from '../timeline/TimelineView'
import { EventEditor } from '../editor/EventEditor'
import { useFocusTrap } from './useFocusTrap'
import type { Id } from '../../domain/model'

type EditorTarget = Id | 'new' | null

function ShellBody() {
  const state = useAppState()
  const [editor, setEditor] = useState<EditorTarget>(null)
  const trapRef = useFocusTrap<HTMLDivElement>(editor !== null, () => setEditor(null))
  // The sidebar can be collapsed/expanded at any width. Default it open on a
  // desktop-width viewport and closed on a narrow one (where it's an overlay
  // drawer). matchMedia is absent in jsdom → fall back to closed for tests.
  const [sidebarOpen, setSidebarOpen] = useState(
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(min-width: 641px)').matches
        : false,
  )

  // useLayoutEffect (not useEffect): the DOM `data-theme` must be set during the
  // commit phase, before TimelineView's passive draw effect reads the CSS
  // variables via getComputedStyle. With a passive effect here the canvas
  // repaints with the old theme's colors and only catches up on the next
  // interaction.
  useLayoutEffect(() => {
    applyTheme(document.documentElement, state.theme)
    persistTheme(window.localStorage, state.theme)
  }, [state.theme])

  return (
    <div className="app-shell">
      <TopBar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className="body">
        <Sidebar open={sidebarOpen} />
        <main className="view-area">
          {state.view === 'list' ? (
            <ListView onEdit={(id) => setEditor(id)} />
          ) : (
            <TimelineView onEdit={(id) => setEditor(id)} />
          )}
          <button type="button" className="fab" aria-label="新建事件" onClick={() => setEditor('new')}>
            <span aria-hidden="true">＋</span>
          </button>
        </main>
        {sidebarOpen && <div className="drawer-backdrop" onClick={() => setSidebarOpen(false)} />}
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
