import { useMemo, useRef, useState } from 'react'
import { useAppStore, useAppState, flattenCategoryTree, liveFolderAt } from '../../state'
import type { Id } from '../../domain/model'
import { nextPresetColor } from '../color/categoryColors'
import { ColorPicker } from '../components/ColorPicker'
import { useT } from '../../i18n/useT'

export function AddFolderForm({ defaultParentId, onCreated, onCancel }:
  { defaultParentId: Id | null; onCreated: (id: Id) => void; onCancel: () => void }) {
  const app = useAppStore()
  const state = useAppState()
  const t = useT()
  const live = state.categories.filter((c) => !c.deleted)
  const colorOf = (id: Id | null) => live.find((c) => c.id === id)?.color
  const defaultColor = (parent: Id | null) => colorOf(parent) ?? nextPresetColor(live.length)

  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [parentId, setParentId] = useState<Id | ''>(defaultParentId ?? '')
  const [color, setColor] = useState<string>(defaultColor(defaultParentId))
  const [touchedColor, setTouchedColor] = useState(false)
  const [swOpen, setSwOpen] = useState(false)
  const dotRef = useRef<HTMLButtonElement>(null)

  const parents = useMemo(() => flattenCategoryTree(state.categories), [state.categories])

  const onParent = (v: Id | '') => {
    setParentId(v)
    if (!touchedColor) setColor(defaultColor(v || null))
  }
  const create = async () => {
    const n = name.trim()
    if (!n) return
    const parent = parentId || null
    if (liveFolderAt(state.categories, n, parent)) {
      setError(t('editor.addFolder.duplicate'))
      return
    }
    setError('')
    const id = await app.createCategory({ name: n, parentId: parent, color })
    onCreated(id)
  }

  return (
    <div className="inlineform">
      <div className="af-title display">{t('editor.addFolder.title')}</div>
      <label className="field"><span className="cap">{t('editor.field.name')}</span>
        <input aria-label={t('editor.field.name')} value={name} autoFocus onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create() }} placeholder={t('editor.addFolder.namePlaceholder')} /></label>
      {error && <div className="errors">{error}</div>}
      <div className="parent-color">
        <label className="field"><span className="cap">{t('editor.addFolder.parent')}</span>
          <select aria-label={t('editor.addFolder.parentAria')} value={parentId} onChange={(e) => onParent(e.target.value as Id | '')}>
            <option value="">{t('editor.addFolder.topOption')}</option>
            {parents.map((pt) => <option key={pt.category.id} value={pt.category.id}>{'　'.repeat(pt.depth) + pt.category.name}</option>)}
          </select></label>
        <button type="button" className="dotbtn" aria-label={t('editor.addFolder.colorAria')} data-picker-trigger ref={dotRef} onClick={() => setSwOpen((o) => !o)}>
          <span className="dot" style={{ background: color }} /></button>
      </div>
      <div className="hint2">{t('editor.addFolder.colorHint')}</div>
      {swOpen && (
        <ColorPicker value={color} anchorRef={dotRef}
          onPick={(hex) => { setColor(hex); setTouchedColor(true); setSwOpen(false) }}
          onClose={() => setSwOpen(false)} />
      )}
      <div className="af-actions">
        <button type="button" className="btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="button" className="btn-sm primary" onClick={create}>{t('common.create')}</button>
      </div>
    </div>
  )
}
