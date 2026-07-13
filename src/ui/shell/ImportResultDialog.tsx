import { useFocusTrap } from './useFocusTrap'
import { ModalOverlay } from './ModalOverlay'
import { useT } from '../../i18n/useT'
import type { MessageKey } from '../../i18n/catalog'
import type { ImportOutcome, ImportSummary } from '../../state'

const LABELS: { key: keyof ImportSummary; label: MessageKey }[] = [
  { key: 'addedEvents', label: 'import.addedEvents' },
  { key: 'overwrittenEvents', label: 'import.overwrittenEvents' },
  { key: 'unchangedEvents', label: 'import.unchangedEvents' },
  { key: 'invalidEvents', label: 'import.invalidEvents' },
  { key: 'addedCategories', label: 'import.addedCategories' },
  { key: 'reusedCategories', label: 'import.reusedCategories' },
  { key: 'addedTags', label: 'import.addedTags' },
  { key: 'reusedTags', label: 'import.reusedTags' },
]

export function ImportResultDialog({ outcome, onClose }: { outcome: ImportOutcome; onClose: () => void }) {
  const t = useT()
  const ref = useFocusTrap<HTMLDivElement>(true, onClose)
  return (
    <ModalOverlay onClose={onClose}>
      <div className="info-card" ref={ref} role="dialog" aria-modal="true" aria-label={t('import.result')}
        onClick={(e) => e.stopPropagation()}>
        {outcome.ok ? (
          <>
            <div className="logo display">{t('import.done')}</div>
            <div className="meta">
              {LABELS.filter(({ key }) => outcome.summary[key] > 0).map(({ key, label }) => (
                <div key={key}><span>{t(label)}</span><b>{outcome.summary[key]}</b></div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="logo display">{t('import.failed')}</div>
            <p>{t(`import.error.${outcome.error}`, outcome.version ? { version: outcome.version } : undefined)}</p>
          </>
        )}
        <button type="button" className="close" onClick={onClose}>{t('common.close')}</button>
      </div>
    </ModalOverlay>
  )
}
