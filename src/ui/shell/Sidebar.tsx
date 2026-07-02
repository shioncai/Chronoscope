import { Overview } from './Overview'
import { FolderPanel } from './FolderPanel'
import { TagPanel } from './TagPanel'
import { SidebarFooter } from './SidebarFooter'

export function Sidebar({ open = false }: { open?: boolean }) {
  return (
    <aside id="sidebar" className={open ? 'sidebar open' : 'sidebar'}>
      <div className="sidebar-scroll">
        <Overview />
        <FolderPanel />
        <TagPanel />
      </div>
      <SidebarFooter />
    </aside>
  )
}
