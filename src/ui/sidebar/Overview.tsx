import { useMemo } from 'react'
import { useAppStore, useAppSelector, overviewCounts, isScopeEmpty, EMPTY_SCOPE } from '../../state'
import { Icon, type IconName } from '../components/Icon'
import { useT } from '../../i18n/useT'

export function Overview({ onNavigate }: { onNavigate?: () => void }) {
  const app = useAppStore()
  const t = useT()
  const events = useAppSelector((s) => s.events)
  const f = useAppSelector((s) => s.filter)
  const counts = useMemo(() => overviewCounts(events), [events])
  const allActive = isScopeEmpty(f.scope) && !f.uncategorized && !f.untagged && !f.trash && f.tagIds.length === 0

  const row = (active: boolean, label: string, count: number, onClick: () => void, icon: IconName) => (
    <button type="button" className={active ? 'nav-row is-active' : 'nav-row'} aria-current={active || undefined}
      onClick={() => {
        onClick()
        onNavigate?.()
      }}>
      <Icon name={icon} size={16} />
      <span className="nav-label">{label}</span>
      <span className="nav-count">{count}</span>
    </button>
  )

  return (
    <nav className="overview" aria-label={t('overview.region')}>
      {row(allActive, t('overview.allEvents'), counts.total,
        () => app.setFilter({ scope: EMPTY_SCOPE, uncategorized: false, untagged: false, trash: false, tagIds: [] }), 'list')}
      {row(!!f.uncategorized, t('overview.uncategorized'), counts.uncategorized,
        () => app.setFilter({ uncategorized: !f.uncategorized, scope: EMPTY_SCOPE, untagged: false, trash: false }), 'circle')}
      {row(!!f.untagged, t('overview.untagged'), counts.untagged,
        () => app.setFilter({ untagged: !f.untagged, tagIds: [], uncategorized: false, trash: false }), 'hash')}
      {row(!!f.trash, t('overview.deleted'), counts.deleted,
        () => app.setFilter({ trash: !f.trash, scope: EMPTY_SCOPE, uncategorized: false, untagged: false, tagIds: [] }), 'trash')}
    </nav>
  )
}
