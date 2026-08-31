import { useAppStore, useAppState, overviewCounts, isScopeEmpty, EMPTY_SCOPE } from '../../state'
import { useT } from '../../i18n/useT'

export function Overview() {
  const app = useAppStore()
  const state = useAppState()
  const t = useT()
  const f = state.filter
  const allActive = isScopeEmpty(f.scope) && !f.uncategorized && !f.untagged && !f.trash && f.tagIds.length === 0
  const counts = overviewCounts(state.events)

  const row = (active: boolean, label: string, count: number, onClick: () => void, glyph: React.ReactNode) => (
    <button type="button" className={active ? 'ov-row active' : 'ov-row'} onClick={onClick}>
      <span className="glyph" aria-hidden="true">{glyph}</span>
      <span className="label">{label}</span>
      <span className="count">{count}</span>
    </button>
  )

  return (
    <div className="overview">
      {row(allActive, t('overview.allEvents'), counts.total,
        () => app.setFilter({ scope: EMPTY_SCOPE, uncategorized: false, untagged: false, trash: false, tagIds: [] }), '≡')}
      {row(!!f.uncategorized, t('overview.uncategorized'), counts.uncategorized,
        () => app.setFilter({ uncategorized: !f.uncategorized, scope: EMPTY_SCOPE, untagged: false, trash: false }), '○')}
      {row(!!f.untagged, t('overview.untagged'), counts.untagged,
        () => app.setFilter({ untagged: !f.untagged, tagIds: [], uncategorized: false, trash: false }), '#')}
      {row(!!f.trash, t('overview.deleted'), counts.deleted,
        () => app.setFilter({ trash: !f.trash, scope: EMPTY_SCOPE, uncategorized: false, untagged: false, tagIds: [] }),
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>)}
    </div>
  )
}
