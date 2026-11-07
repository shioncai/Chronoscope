import type { RefObject } from 'react'
import { useAppStore, useAppSelector, shallowEqual } from '../../state'
import { Icon, Mark } from '../components/Icon'
import { historyLabel } from './historyLabel'
import { useT, useLocale } from '../../i18n/useT'

export interface TopBarProps {
  onToggleSidebar?: () => void
  sidebarOpen?: boolean
  searchRef?: RefObject<HTMLInputElement | null>
  onUndo?: () => void
  onRedo?: () => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl+'

export function TopBar({ onToggleSidebar, sidebarOpen = false, searchRef, onUndo, onRedo }: TopBarProps) {
  const app = useAppStore()
  const t = useT()
  const locale = useLocale()
  const { query, view, history } = useAppSelector(
    (s) => ({ query: s.filter.query, view: s.view, history: s.history }),
    shallowEqual,
  )
  const undoTitle = history.undo ? `${t('topbar.undo')}: ${historyLabel(locale, history.undo)} (${MOD}Z)` : t('topbar.undo')
  const redoTitle = history.redo ? `${t('topbar.redo')}: ${historyLabel(locale, history.redo)} (${MOD}${isMac ? '⇧Z' : 'Y'})` : t('topbar.redo')

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-btn"
        aria-label={t('topbar.menu')}
        title={`${t('topbar.menu')} ([)`}
        aria-controls="sidebar"
        aria-expanded={sidebarOpen}
        onClick={onToggleSidebar}
      >
        <Icon name="menu" size={18} />
      </button>
      <span className="brand">
        <Mark size={22} />
        <span className="brand-name">Chronoscope</span>
      </span>
      <div className="search-box">
        <Icon name="search" size={16} />
        <input
          ref={searchRef}
          type="search"
          aria-label={t('topbar.searchAria')}
          placeholder={t('topbar.searchPlaceholder')}
          value={query}
          onChange={(e) => app.setFilter({ query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              if (query) app.setFilter({ query: '' })
              else e.currentTarget.blur()
            }
          }}
        />
        {query ? (
          <button type="button" className="search-clear" aria-label={t('topbar.clearSearch')} onClick={() => {
            app.setFilter({ query: '' })
            searchRef?.current?.focus()
          }}>
            <Icon name="close" size={14} />
          </button>
        ) : (
          <kbd className="search-hint" aria-hidden="true">/</kbd>
        )}
      </div>
      <div className="topbar-actions">
        <button type="button" className="icon-btn" aria-label={t('topbar.undo')} title={undoTitle}
          disabled={!history.undo} onClick={onUndo}>
          <Icon name="undo" size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label={t('topbar.redo')} title={redoTitle}
          disabled={!history.redo} onClick={onRedo}>
          <Icon name="redo" size={18} />
        </button>
      </div>
      <nav className="segmented view-switch" aria-label={t('topbar.views')}>
        <button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'}
          title={`${t('topbar.list')} (1)`} onClick={() => app.setView('list')}>
          <Icon name="list" size={16} />
          <span className="seg-label">{t('topbar.list')}</span>
        </button>
        <button type="button" className={view === 'timeline' ? 'is-active' : ''} aria-pressed={view === 'timeline'}
          title={`${t('topbar.timeline')} (2)`} onClick={() => app.setView('timeline')}>
          <Icon name="timeline" size={16} />
          <span className="seg-label">{t('topbar.timeline')}</span>
        </button>
      </nav>
    </header>
  )
}
