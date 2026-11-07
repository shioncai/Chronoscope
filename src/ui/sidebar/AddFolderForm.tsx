import { useMemo, useRef, useState } from 'react'
import { useAppStore, useAppSelector, flattenCategoryTree, liveFolderAt } from '../../state'
import type { Id } from '../../domain/model'
import { nextPresetColor } from '../color/categoryColors'
import { ColorPicker } from '../components/ColorPicker'
import { useT } from '../../i18n/useT'

export function AddFolderForm({ defaultParentId, onCreated, onCancel }:
  { defaultParentId: Id | null; onCreated: (id: Id) => void; onCancel: () => void }) {
  const app = useAppStore()
  const t = useT()
  const categories = useAppSelector((s) => s.categories)
  const live = useMemo(() => categories.filter((c) => !c.deleted), [categories])
  const colorOf = (id: Id | null) => live.find((c) => c.id === id)?.color
  // A subfolder inherits its parent's colour; a top-level folder takes the next
  // preset hue, so siblings start out distinguishable.
  const defaultColor = (parent: Id | null) => colorOf(parent) ?? nextPresetColor(live.filter((c) => c.parentId == null).length)

  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [parentId, setParentId] = useState<Id | ''>(defaultParentId ?? '')
  const [color, setColor] = useState<string>(defaultColor(defaultParentId))
  const [touchedColor, setTouchedColor] = useState(false)
  const [swOpen, setSwOpen] = useState(false)
  const dotRef = useRef<HTMLButtonElement>(null)

  const parents = useMemo(() => flattenCategoryTree(categories), [categories])

  const onParent = (v: Id | '') => {
    setParentId(v)
    if (!touchedColor) setColor(defaultColor(v || null))
  }
  const create = async () => {
    const n = name.trim()
    if (!n) return
    const parent = parentId || null
    if (liveFolderAt(categories, n, parent)) {
      setError(t('editor.addFolder.duplicate'))
      return
    }
    setError('')
    const order = live.filter((c) => c.parentId === parent).reduce((m, c) => Math.max(m, c.order + 1), 0)
    const id = await app.createCategory({ name: n, parentId: parent, color, order })
    onCreated(id)
  }

  return (
    <div className="inline-form" onKeyDown={(e) => { if (e.key === 'Escape' && !swOpen) { e.stopPropagation(); onCancel() } }}>
      <label className="field">
        <span className="field-label">{t('editor.field.name')}</span>
        <input aria-label={t('editor.field.name')} value={name} autoFocus onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void create() }} placeholder={t('editor.addFolder.namePlaceholder')} />
      </label>
      {error && <div className="field-error">{error}</div>}
      <div className="field-row">
        <label className="field field--grow">
          <span className="field-label">{t('editor.addFolder.parent')}</span>
          <select aria-label={t('editor.addFolder.parentAria')} value={parentId} onChange={(e) => onParent(e.target.value as Id | '')}>
            <option value="">{t('editor.addFolder.topOption')}</option>
            {parents.map((pt) => <option key={pt.category.id} value={pt.category.id}>{'　'.repeat(pt.depth) + pt.category.name}</option>)}
          </select>
        </label>
        <button type="button" className="swatch-btn" aria-label={t('editor.addFolder.colorAria')} data-picker-trigger ref={dotRef}
          onClick={() => setSwOpen((o) => !o)}>
          <span className="dot" style={{ background: color }} />
        </button>
      </div>
      {swOpen && (
        <ColorPicker value={color} anchorRef={dotRef}
          onPick={(hex) => { setColor(hex); setTouchedColor(true); setSwOpen(false) }}
          onClose={() => setSwOpen(false)} />
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void create()} disabled={!name.trim()}>{t('common.create')}</button>
      </div>
    </div>
  )
}
