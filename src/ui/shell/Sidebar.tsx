import type { PointerEvent as ReactPointerEvent } from 'react'
import { Overview } from './Overview'
import { FolderPanel } from './FolderPanel'
import { TagPanel } from './TagPanel'
import { SidebarFooter } from './SidebarFooter'
import type { Id } from '../../domain/model'
import { useT } from '../../i18n/useT'

export interface SidebarProps {
  open?: boolean
  onResizeStart?: (e: ReactPointerEvent) => void
  onEdit: (id: Id) => void
}

export function Sidebar({ open = false, onResizeStart, onEdit }: SidebarProps) {
  const t = useT()
  return (
    <aside id="sidebar" className={open ? 'sidebar open' : 'sidebar'}>
      <div className="sidebar-scroll">
        <Overview />
        <FolderPanel onEdit={onEdit} />
        <TagPanel />
      </div>
      <SidebarFooter />
      {onResizeStart && (
        <div className="sidebar-resize" role="separator" aria-orientation="vertical"
          aria-label={t('shell.resizeSidebar')} onPointerDown={onResizeStart} />
      )}
    </aside>
  )
}
