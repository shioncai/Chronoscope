import { useState } from 'react'
import { useAppStore } from '../../state'
import type { Id } from '../../domain/model'
import { useT } from '../../i18n/useT'

export function AddTagForm({ onCreated, onCancel }: { onCreated: (id: Id) => void; onCancel: () => void }) {
  const app = useAppStore()
  const t = useT()
  const [name, setName] = useState('')
  const create = async () => {
    const n = name.trim()
    if (!n) return
    const id = await app.createTag({ name: n })
    onCreated(id)
  }
  return (
    <div className="inlineform">
      <div className="af-title display">{t('editor.addTag.title')}</div>
      <label className="field"><span className="cap">{t('editor.field.name')}</span>
        <input aria-label={t('editor.addTag.nameAria')} value={name} autoFocus onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create() }} placeholder={t('editor.addTag.namePlaceholder')} /></label>
      <div className="af-actions">
        <button type="button" className="btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="button" className="btn-sm primary" onClick={create}>{t('common.create')}</button>
      </div>
    </div>
  )
}
