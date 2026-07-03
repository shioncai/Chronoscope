import { useFocusTrap } from './useFocusTrap'
import type { ImportOutcome, ImportSummary } from '../../state'

const LABELS: { key: keyof ImportSummary; label: string }[] = [
  { key: 'addedEvents', label: '新增事件' },
  { key: 'skippedEvents', label: '跳过（已存在）' },
  { key: 'invalidEvents', label: '忽略（无效）' },
  { key: 'addedCategories', label: '新增文件夹' },
  { key: 'reusedCategories', label: '复用文件夹' },
  { key: 'addedTags', label: '新增标签' },
  { key: 'reusedTags', label: '复用标签' },
]

export function ImportResultDialog({ outcome, onClose }: { outcome: ImportOutcome; onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(true, onClose)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="info-card" ref={ref} role="dialog" aria-modal="true" aria-label="导入结果"
        onClick={(e) => e.stopPropagation()}>
        {outcome.ok ? (
          <>
            <div className="logo display">导入完成</div>
            <div className="meta">
              {LABELS.filter(({ key }) => outcome.summary[key] > 0).map(({ key, label }) => (
                <div key={key}><span>{label}</span><b>{outcome.summary[key]}</b></div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="logo display">导入失败</div>
            <p>{outcome.error}</p>
          </>
        )}
        <button type="button" className="close" onClick={onClose}>关闭</button>
      </div>
    </div>
  )
}
