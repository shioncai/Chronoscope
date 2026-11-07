import { useAppStore, useAppSelector, useVisibleEvents, isScopeEmpty, EMPTY_SCOPE, shallowEqual } from '../../state'
import { Icon } from '../components/Icon'
import { useConfirm } from '../components/useConfirm'
import { useToast } from '../components/useToast'
import { useT, useTn } from '../../i18n/useT'

/**
 * What is narrowing the views right now, as removable chips, plus how many
 * events survive it. Both views share one filter, so this sits above both —
 * the answer to "why is my event not here?".
 */
export function FilterBar() {
  const app = useAppStore()
  const t = useT()
  const tn = useTn()
  const confirm = useConfirm()
  const toast = useToast()
  const { filter, categories, tags } = useAppSelector(
    (s) => ({ filter: s.filter, categories: s.categories, tags: s.tags }),
    shallowEqual,
  )
  const count = useVisibleEvents().length
  const f = filter

  const chips: { key: string; label: string; clear: () => void }[] = []
  if (f.trash) chips.push({ key: 'trash', label: t('filter.trash'), clear: () => app.setFilter({ trash: false }) })
  if (f.uncategorized) chips.push({ key: 'unc', label: t('filter.uncategorized'), clear: () => app.setFilter({ uncategorized: false }) })
  if (f.untagged) chips.push({ key: 'unt', label: t('filter.untagged'), clear: () => app.setFilter({ untagged: false }) })
  if (!isScopeEmpty(f.scope)) {
    const names = f.scope.folderIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean) as string[]
    const extra = f.scope.includeEvents.length
    const label = names.length
      ? names.length > 2
        ? t('filter.foldersMany', { first: names.slice(0, 2).join(t('common.listSeparator')), n: names.length - 2 })
        : names.join(t('common.listSeparator'))
      : t('filter.selection')
    chips.push({
      key: 'scope',
      label: extra && names.length ? `${label} ${t('filter.plusEvents', { n: extra })}` : label,
      clear: () => app.setFilter({ scope: EMPTY_SCOPE }),
    })
  }
  if (f.tagIds.length) {
    const names = f.tagIds.map((id) => tags.find((x) => x.id === id)?.name).filter(Boolean)
    const joiner = f.tagMode === 'and' ? ' + ' : ' / '
    chips.push({ key: 'tags', label: `# ${names.join(joiner)}`, clear: () => app.setFilter({ tagIds: [] }) })
  }
  if (f.query.trim()) chips.push({ key: 'q', label: `“${f.query.trim()}”`, clear: () => app.setFilter({ query: '' }) })

  if (chips.length === 0) return null

  const emptyTrash = async () => {
    const ok = await confirm({
      title: t('filter.emptyTrashTitle'),
      message: tn('filter.emptyTrashMessage', count),
      confirmLabel: t('filter.emptyTrash'),
      danger: true,
    })
    if (!ok) return
    await app.emptyTrash()
    toast({ message: tn('toast.purged', count), action: { label: t('common.undo'), run: () => void app.undo() } })
  }

  return (
    <div className="filter-bar" role="region" aria-label={t('filter.region')}>
      <span className="filter-count">{tn('filter.count', count)}</span>
      <div className="filter-chips">
        {chips.map((c) => (
          <span key={c.key} className="chip">
            <span className="chip-label">{c.label}</span>
            <button type="button" className="chip-x" aria-label={t('filter.remove', { name: c.label })} onClick={c.clear}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="filter-actions">
        {f.trash && count > 0 && (
          <button type="button" className="btn btn-sm btn-danger-quiet" onClick={() => void emptyTrash()}>
            <Icon name="trash" size={14} />
            <span>{t('filter.emptyTrash')}</span>
          </button>
        )}
        <button type="button" className="btn btn-sm btn-quiet" onClick={() => app.resetFilter()}>
          {t('filter.clearAll')}
        </button>
      </div>
    </div>
  )
}
