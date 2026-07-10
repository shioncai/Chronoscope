import { useT } from '../../i18n/useT'

export interface PillProps {
  label: string
  count?: number
  active?: boolean
  onToggle: () => void
  onDelete?: () => void
}

export function Pill({ label, count, active, onToggle, onDelete }: PillProps) {
  const t = useT()
  return (
    <button type="button" className={active ? 'pill on' : 'pill'} aria-pressed={active} onClick={onToggle}>
      <span className="pl">{label}</span>
      {count !== undefined && <span className="n">{count}</span>}
      {onDelete && (
        <span className="x" role="button" aria-label={t('common.deleteNamed', { name: label })}
          onClick={(e) => { e.stopPropagation(); onDelete() }}>×</span>
      )}
    </button>
  )
}
