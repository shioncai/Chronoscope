import { useFocusTrap } from '../hooks/useFocusTrap'
import { ModalOverlay } from '../components/ModalOverlay'
import { Icon } from '../components/Icon'
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
  const rows = outcome.ok ? LABELS.filter(({ key }) => outcome.summary[key] > 0) : []
  return (
    <ModalOverlay center onClose={onClose}>
      <div className="dialog" ref={ref} role="dialog" aria-modal="true" aria-label={t('import.result')}
        onClick={(e) => e.stopPropagation()}>
        {outcome.ok ? (
          <>
            <h2 className="dialog-title"><Icon name="check" size={18} /> {t('import.done')}</h2>
            {rows.length === 0 ? (
              <p className="dialog-text">{t('import.nothing')}</p>
            ) : (
              <dl className="about-meta">
                {rows.map(({ key, label }) => (
                  <div key={key}><dt>{t(label)}</dt><dd>{outcome.summary[key]}</dd></div>
                ))}
              </dl>
            )}
            {outcome.summary.addedEvents + outcome.summary.overwrittenEvents > 0 && (
              <p className="dialog-hint">{t('import.undoHint')}</p>
            )}
          </>
        ) : (
          <>
            <h2 className="dialog-title">{t('import.failed')}</h2>
            <p className="dialog-text">{t(`import.error.${outcome.error}`, outcome.version ? { version: outcome.version } : undefined)}</p>
          </>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" data-autofocus onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </ModalOverlay>
  )
}
