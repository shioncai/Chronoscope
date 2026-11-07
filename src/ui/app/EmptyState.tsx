import { useAppStore } from '../../state'
import type { EmptyKind } from './useEmptyKind'
import { Icon, Mark } from '../components/Icon'
import { useToast } from '../components/useToast'
import { useDataTransfer } from './useDataTransfer'
import { buildSampleFile } from '../onboarding/sample'
import { useT, useLocale, useTn } from '../../i18n/useT'


/** What a view shows when it has nothing to show — and the way out of it. */
export function EmptyState({ kind, onNew }: { kind: EmptyKind; onNew: () => void }) {
  const app = useAppStore()
  const t = useT()
  const tn = useTn()
  const locale = useLocale()
  const toast = useToast()
  const data = useDataTransfer()

  if (kind === 'trash') {
    return (
      <div className="empty-state">
        <span className="empty-icon"><Icon name="trash" size={26} /></span>
        <h2>{t('list.trashEmpty')}</h2>
        <p>{t('empty.trashHint')}</p>
      </div>
    )
  }
  if (kind === 'filtered') {
    return (
      <div className="empty-state">
        <span className="empty-icon"><Icon name="search" size={26} /></span>
        <h2>{t('empty.filteredTitle')}</h2>
        <p>{t('empty.filteredHint')}</p>
        <div className="empty-actions">
          <button type="button" className="btn" onClick={() => app.resetFilter()}>{t('filter.clearAll')}</button>
        </div>
      </div>
    )
  }
  const loadSample = async () => {
    const summary = await app.importFile(buildSampleFile(locale, new Date()), 'sample')
    toast({
      message: tn('toast.sampleLoaded', summary.addedEvents),
      action: { label: t('common.undo'), run: () => void app.undo() },
    })
  }
  return (
    <div className="empty-state empty-state--welcome">
      <Mark size={56} />
      <h2>{t('list.empty')}</h2>
      <p>{t('empty.welcomeHint')}</p>
      <div className="empty-actions">
        <button type="button" className="btn btn-primary" onClick={onNew}>
          <Icon name="plus" size={16} />
          <span>{t('common.newEvent')}</span>
        </button>
        <button type="button" className="btn" onClick={() => void loadSample()}>
          <Icon name="sparkle" size={16} />
          <span>{t('empty.loadSample')}</span>
        </button>
        <button type="button" className="btn btn-quiet" onClick={data.openImport}>
          <Icon name="upload" size={16} />
          <span>{t('empty.import')}</span>
        </button>
      </div>
    </div>
  )
}
