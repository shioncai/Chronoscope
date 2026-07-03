import { useEffect, useMemo, useState } from 'react'
import { useAppStore, useAppState, flattenCategoryTree, liveFolderAt } from '../../state'
import type { Id } from '../../domain/model'
import { CATEGORY_PRESETS, nextPresetColor, loadCustomColors, persistCustomColors, addToPalette } from '../categoryColors'
import { ColorPicker } from './ColorPicker'

export function AddFolderForm({ defaultParentId, onCreated, onCancel }:
  { defaultParentId: Id | null; onCreated: (id: Id) => void; onCancel: () => void }) {
  const app = useAppStore()
  const state = useAppState()
  const live = state.categories.filter((c) => !c.deleted)
  const colorOf = (id: Id | null) => live.find((c) => c.id === id)?.color
  const defaultColor = (parent: Id | null) => colorOf(parent) ?? nextPresetColor(live.length)

  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [parentId, setParentId] = useState<Id | ''>(defaultParentId ?? '')
  const [color, setColor] = useState<string>(defaultColor(defaultParentId))
  const [touchedColor, setTouchedColor] = useState(false)
  const [swOpen, setSwOpen] = useState(false)
  const [custom, setCustom] = useState<string[]>(() => loadCustomColors(window.localStorage))
  useEffect(() => { persistCustomColors(window.localStorage, custom) }, [custom])

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
      setError('同一位置已存在同名文件夹')
      return
    }
    setError('')
    const id = await app.createCategory({ name: n, parentId: parent, color })
    onCreated(id)
  }

  return (
    <div className="inlineform">
      <div className="af-title display">新建文件夹</div>
      <label className="field"><span className="cap">名称</span>
        <input aria-label="名称" value={name} autoFocus onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create() }} placeholder="例如：宋朝" /></label>
      {error && <div className="errors">{error}</div>}
      <div className="parent-color">
        <label className="field"><span className="cap">父文件夹（层级）</span>
          <select aria-label="父文件夹" value={parentId} onChange={(e) => onParent(e.target.value as Id | '')}>
            <option value="">顶级（无父文件夹）</option>
            {parents.map((t) => <option key={t.category.id} value={t.category.id}>{'　'.repeat(t.depth) + t.category.name}</option>)}
          </select></label>
        <button type="button" className="dotbtn" aria-label="颜色" onClick={() => setSwOpen((o) => !o)}>
          <span className="dot" style={{ background: color }} /></button>
      </div>
      <div className="hint2">默认颜色继承父文件夹；顶级则取下一预设色，可改。</div>
      {swOpen && (
        <ColorPicker value={color} presets={CATEGORY_PRESETS} custom={custom}
          onPick={(hex) => { setColor(hex); setTouchedColor(true); setSwOpen(false) }}
          onAddCustom={(hex) => setCustom((p) => addToPalette(p, hex))} />
      )}
      <div className="af-actions">
        <button type="button" className="btn-sm" onClick={onCancel}>取消</button>
        <button type="button" className="btn-sm primary" onClick={create}>创建</button>
      </div>
    </div>
  )
}
