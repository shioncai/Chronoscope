import { useState } from 'react'
import { useAppStore } from '../../state'
import type { Id } from '../../domain/model'

export function AddTagForm({ onCreated, onCancel }: { onCreated: (id: Id) => void; onCancel: () => void }) {
  const app = useAppStore()
  const [name, setName] = useState('')
  const create = async () => {
    const n = name.trim()
    if (!n) return
    const id = await app.createTag({ name: n })
    onCreated(id)
  }
  return (
    <div className="inlineform">
      <div className="af-title display">新建标签</div>
      <label className="field"><span className="cap">名称</span>
        <input aria-label="标签名称" value={name} autoFocus onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create() }} placeholder="例如：旅行" /></label>
      <div className="af-actions">
        <button type="button" className="btn-sm" onClick={onCancel}>取消</button>
        <button type="button" className="btn-sm primary" onClick={create}>创建</button>
      </div>
    </div>
  )
}
