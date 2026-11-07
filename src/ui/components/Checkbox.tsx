import type { CheckState } from '../../state'

export function Checkbox({ state, label, onClick }: {
  state: CheckState
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" role="checkbox"
      aria-checked={state === 'checked' ? true : state === 'indeterminate' ? 'mixed' : false}
      aria-label={label} className={`tree-cb cb-${state}`}
      onClick={(e) => { e.stopPropagation(); onClick() }}>
      {state === 'checked' && (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="3,8 7,12 13,4" /></svg>
      )}
      {state === 'indeterminate' && (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3"><line x1="4" y1="8" x2="12" y2="8" /></svg>
      )}
    </button>
  )
}
