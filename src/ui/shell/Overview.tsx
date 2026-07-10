import { useAppStore, useAppState, untaggedCount, deletedCount, isScopeEmpty, EMPTY_SCOPE } from '../../state'
import { useT } from '../../i18n/useT'

export function Overview() {
  const app = useAppStore()
  const state = useAppState()
  const t = useT()
  const f = state.filter
  const allActive = isScopeEmpty(f.scope) && !f.uncategorized && !f.untagged && !f.trash && f.tagIds.length === 0
  const liveTotal = state.events.filter((e) => !e.deleted).length
  const uncat = state.events.filter((e) => !e.deleted && e.categoryId == null).length

  const row = (active: boolean, label: string, count: number, onClick: () => void, glyph: React.ReactNode) => (
    <button type="button" className={active ? 'ov-row active' : 'ov-row'} onClick={onClick}>
      <span className="glyph" aria-hidden="true">{glyph}</span>
      <span className="label">{label}</span>
      <span className="count">{count}</span>
    </button>
  )

  return (
    <div className="overview">
      {row(allActive, t('overview.allEvents'), liveTotal,
        () => app.setFilter({ scope: EMPTY_SCOPE, uncategorized: false, untagged: false, trash: false, tagIds: [] }), '≡')}
      {row(!!f.uncategorized, t('overview.uncategorized'), uncat,
        () => app.setFilter({ uncategorized: !f.uncategorized, scope: EMPTY_SCOPE, untagged: false, trash: false }), '○')}
      {row(!!f.untagged, t('overview.untagged'), untaggedCount(state),
        () => app.setFilter({ untagged: !f.untagged, tagIds: [], uncategorized: false, trash: false }), '#')}
      {row(!!f.trash, t('overview.deleted'), deletedCount(state),
        () => app.setFilter({ trash: !f.trash, scope: EMPTY_SCOPE, uncategorized: false, untagged: false, tagIds: [] }),
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>)}
    </div>
  )
}
