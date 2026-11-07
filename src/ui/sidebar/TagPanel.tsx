import { useMemo, useState } from 'react'
import { useAppStore, useAppSelector } from '../../state'
import type { Id } from '../../domain/model'
import { Pill } from '../components/Pill'
import { useToast } from '../components/useToast'
import { AddTagForm } from './AddTagForm'
import { useT } from '../../i18n/useT'

export function TagPanel() {
  const app = useAppStore()
  const t = useT()
  const toast = useToast()
  const allTags = useAppSelector((s) => s.tags)
  const events = useAppSelector((s) => s.events)
  const f = useAppSelector((s) => s.filter)
  const tags = useMemo(() => allTags.filter((tag) => !tag.deleted), [allTags])
  const [addOpen, setAddOpen] = useState(false)
  const [renaming, setRenaming] = useState<Id | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [renameError, setRenameError] = useState('')

  // One pass for every tag's count, rather than a full scan of the events per tag.
  const counts = useMemo(() => {
    const m = new Map<Id, number>()
    for (const e of events) {
      if (e.deleted) continue
      for (const id of e.tagIds) m.set(id, (m.get(id) ?? 0) + 1)
    }
    return m
  }, [events])

  const toggle = (id: Id) =>
    app.setFilter({ tagIds: f.tagIds.includes(id) ? f.tagIds.filter((x) => x !== id) : [...f.tagIds, id], untagged: false, trash: false })
  const del = async (id: Id, name: string) => {
    await app.deleteTag(id)
    toast({ message: t('toast.tagDeleted', { name }), action: { label: t('common.undo'), run: () => void app.undo() } })
  }
  const commitRename = () => {
    const name = renameVal.trim()
    const self = tags.find((x) => x.id === renaming)
    if (self && name && name !== self.name) {
      if (tags.some((x) => x.id !== self.id && x.name === name)) {
        setRenameError(t('sidebar.tagDuplicate'))
        return
      }
      void app.updateTag(self.id, { name })
    }
    setRenaming(null)
    setRenameError('')
  }

  return (
    <section className="module">
      <div className="module-head">
        <h2>{t('sidebar.tags')}</h2>
        {tags.length > 1 && (
          <button type="button" className="logic-btn" aria-label={t('sidebar.tagLogic')}
            title={t(f.tagMode === 'or' ? 'sidebar.tagLogicOr' : 'sidebar.tagLogicAnd')}
            onClick={() => app.setFilter({ tagMode: f.tagMode === 'or' ? 'and' : 'or' })}>
            {f.tagMode === 'or' ? t('sidebar.tagAny') : t('sidebar.tagAll')}
          </button>
        )}
      </div>
      <div className="pills">
        {tags.map((tag) =>
          renaming === tag.id ? (
            <input key={tag.id} className="pill-input" autoFocus value={renameVal} aria-label={t('sidebar.renameTag', { name: tag.name })}
              onChange={(e) => setRenameVal(e.target.value)} onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                else if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); setRenameError('') }
              }} />
          ) : (
            <Pill key={tag.id} label={tag.name} count={counts.get(tag.id) ?? 0} active={f.tagIds.includes(tag.id)}
              onToggle={() => toggle(tag.id)} onDelete={() => void del(tag.id, tag.name)}
              onRename={() => { setRenaming(tag.id); setRenameVal(tag.name); setRenameError('') }} />
          ),
        )}
        <button type="button" className="pill-add" aria-label={t('sidebar.addTag')} aria-expanded={addOpen}
          onClick={() => setAddOpen((o) => !o)}>
          {t('editor.newTag')}
        </button>
      </div>
      {renameError && <div className="field-error">{renameError}</div>}
      {addOpen && <AddTagForm onCreated={() => setAddOpen(false)} onCancel={() => setAddOpen(false)} />}
    </section>
  )
}
