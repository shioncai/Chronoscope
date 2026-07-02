import { useAppStore, useAppState } from '../../state'

export interface TopBarProps {
  onToggleSidebar?: () => void
  sidebarOpen?: boolean
}

export function TopBar({ onToggleSidebar, sidebarOpen = false }: TopBarProps) {
  const app = useAppStore()
  const state = useAppState()
  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-btn drawer-toggle"
        aria-label="菜单"
        aria-controls="sidebar"
        aria-expanded={sidebarOpen}
        onClick={onToggleSidebar}
      >
        ☰
      </button>
      <span className="display title">Chronoscope</span>
      <div className="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          aria-label="搜索事件"
          placeholder="搜索事件…"
          value={state.filter.query}
          onChange={(e) => app.setFilter({ query: e.target.value })}
        />
      </div>
      <nav className="view-switch">
        <button type="button" className={state.view === 'list' ? 'active' : ''} aria-pressed={state.view === 'list'} onClick={() => app.setView('list')}>
          列表
        </button>
        <button
          type="button"
          className={state.view === 'timeline' ? 'active' : ''}
          aria-pressed={state.view === 'timeline'}
          onClick={() => app.setView('timeline')}
        >
          时间轴
        </button>
      </nav>
    </header>
  )
}
