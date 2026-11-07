import { useFocusTrap } from '../hooks/useFocusTrap'
import { ModalOverlay } from '../components/ModalOverlay'
import { useT } from '../../i18n/useT'
import type { MessageKey } from '../../i18n/catalog'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

const GROUPS: { title: MessageKey; keys: { keys: string[]; label: MessageKey }[] }[] = [
  {
    title: 'shortcuts.general',
    keys: [
      { keys: ['N'], label: 'shortcuts.newEvent' },
      { keys: ['/'], label: 'shortcuts.search' },
      { keys: [MOD, 'K'], label: 'shortcuts.search' },
      { keys: ['1'], label: 'shortcuts.list' },
      { keys: ['2'], label: 'shortcuts.timeline' },
      { keys: ['['], label: 'shortcuts.sidebar' },
      { keys: [MOD, 'Z'], label: 'shortcuts.undo' },
      { keys: isMac ? [MOD, '⇧', 'Z'] : [MOD, 'Y'], label: 'shortcuts.redo' },
      { keys: ['?'], label: 'shortcuts.help' },
    ],
  },
  {
    title: 'shortcuts.timelineGroup',
    keys: [
      { keys: ['←', '→'], label: 'shortcuts.pan' },
      { keys: ['+', '−'], label: 'shortcuts.zoom' },
      { keys: ['0'], label: 'shortcuts.fit' },
      { keys: ['T'], label: 'shortcuts.now' },
      { keys: ['L'], label: 'shortcuts.axis' },
      { keys: ['G'], label: 'shortcuts.lanes' },
      { keys: ['Enter'], label: 'shortcuts.open' },
      { keys: ['Del'], label: 'shortcuts.delete' },
    ],
  },
  {
    title: 'shortcuts.listGroup',
    keys: [
      { keys: [MOD, 'A'], label: 'shortcuts.selectAll' },
      { keys: ['Del'], label: 'shortcuts.deleteChecked' },
      { keys: ['Esc'], label: 'shortcuts.clear' },
    ],
  },
]

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const ref = useFocusTrap<HTMLDivElement>(true, onClose)
  return (
    <ModalOverlay center onClose={onClose}>
      <div className="dialog dialog--wide" ref={ref} role="dialog" aria-modal="true" aria-label={t('shortcuts.title')}
        onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">{t('shortcuts.title')}</h2>
        <div className="shortcut-groups">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3>{t(g.title)}</h3>
              <dl className="shortcut-list">
                {g.keys.map((k, i) => (
                  <div key={i}>
                    <dt>{k.keys.map((key) => <kbd key={key}>{key}</kbd>)}</dt>
                    <dd>{t(k.label)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" data-autofocus onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </ModalOverlay>
  )
}
