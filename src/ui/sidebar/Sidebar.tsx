import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Overview } from './Overview'
import { FolderPanel } from './FolderPanel'
import { TagPanel } from './TagPanel'
import { SidebarFooter } from './SidebarFooter'
import type { Id } from '../../domain/model'
import { useT } from '../../i18n/useT'

export interface SidebarProps {
  open?: boolean
  onResizeStart?: (e: ReactPointerEvent) => void
  /** Keyboard resize: a signed width delta in px. */
  onResizeKey?: (delta: number) => void
  onEdit: (id: Id) => void
  onHelp?: () => void
  /** Called after a pick that should close the drawer on a phone. */
  onNavigate?: () => void
}

export function Sidebar({ open = false, onResizeStart, onResizeKey, onEdit, onHelp, onNavigate }: SidebarProps) {
  const t = useT()
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') onResizeKey?.(-16)
    else if (e.key === 'ArrowRight') onResizeKey?.(16)
    else return
    e.preventDefault()
  }
  return (
    <aside id="sidebar" className={open ? 'sidebar open' : 'sidebar'} aria-label={t('sidebar.region')}
      inert={!open || undefined}>
      <div className="sidebar-scroll">
        <Overview onNavigate={onNavigate} />
        <FolderPanel onEdit={onEdit} />
        <TagPanel />
      </div>
      <SidebarFooter onHelp={onHelp} />
      {onResizeStart && (
        <div className="sidebar-resize" role="separator" aria-orientation="vertical" tabIndex={0}
          aria-label={t('shell.resizeSidebar')} onPointerDown={onResizeStart} onKeyDown={onKey} />
      )}
    </aside>
  )
}
