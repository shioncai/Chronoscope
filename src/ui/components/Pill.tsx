import { Icon } from './Icon'
import { useT } from '../../i18n/useT'

export interface PillProps {
  label: string
  count?: number
  active?: boolean
  onToggle: () => void
  onDelete?: () => void
  onRename?: () => void
}

/** A toggleable tag chip. Delete is its own button beside the chip — never a
 *  "button" nested inside another button, which no assistive tech can reach. */
export function Pill({ label, count, active, onToggle, onDelete, onRename }: PillProps) {
  const t = useT()
  return (
    <span className={active ? 'pill is-on' : 'pill'}>
      <button type="button" className="pill-main" aria-pressed={!!active} onClick={onToggle}
        onDoubleClick={onRename} title={onRename ? t('sidebar.tagHint') : undefined}>
        <span className="pill-label">{label}</span>
        {count !== undefined && <span className="pill-count">{count}</span>}
      </button>
      {onDelete && (
        <button type="button" className="pill-x" aria-label={t('common.deleteNamed', { name: label })} onClick={onDelete}>
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  )
}
