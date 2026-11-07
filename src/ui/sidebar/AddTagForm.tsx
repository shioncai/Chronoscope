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
    // createTag hands back the existing tag when the name is taken, so typing a
    // name that exists simply picks that tag instead of minting a twin.
    onCreated(await app.createTag({ name: n }))
  }
  return (
    <div className="inline-form" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }}>
      <label className="field">
        <span className="field-label">{t('editor.field.name')}</span>
        <input aria-label={t('editor.addTag.nameAria')} value={name} autoFocus onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void create() }} placeholder={t('editor.addTag.namePlaceholder')} />
      </label>
      <div className="form-actions">
        <button type="button" className="btn btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void create()} disabled={!name.trim()}>{t('common.create')}</button>
      </div>
    </div>
  )
}
