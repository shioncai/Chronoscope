import { useState } from 'react'
import { useAppStore, useAppState } from '../../state'
import type { Id } from '../../domain/model'
import { Pill } from '../components/Pill'
import { AddTagForm } from './AddTagForm'
import { useT } from '../../i18n/useT'

export function TagPanel() {
  const app = useAppStore()
  const state = useAppState()
  const t = useT()
  const tags = state.tags.filter((tag) => !tag.deleted)
  const f = state.filter
  const [addOpen, setAddOpen] = useState(false)

  // One pass for every tag's count, rather than a full scan of the events per tag.
  const counts = new Map<Id, number>()
  for (const e of state.events) {
    if (e.deleted) continue
    for (const id of e.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const toggle = (id: Id) =>
    app.setFilter({ tagIds: f.tagIds.includes(id) ? f.tagIds.filter((x) => x !== id) : [...f.tagIds, id], untagged: false, trash: false })
  const del = (id: Id, name: string) => {
    if (!window.confirm(t('sidebar.deleteTagConfirm', { name }))) return
    app.deleteTag(id)
    if (f.tagIds.includes(id)) app.setFilter({ tagIds: f.tagIds.filter((x) => x !== id) })
  }

  return (
    <section className="module">
      <div className="module-head">
        <h2>{t('sidebar.tags')}</h2>
        <button type="button" className="logic-btn" aria-label={t('sidebar.tagLogic')}
          onClick={() => app.setFilter({ tagMode: f.tagMode === 'or' ? 'and' : 'or' })}>
          {f.tagMode === 'or' ? 'OR' : 'AND'}
        </button>
      </div>
      <div className="pills">
        {tags.map((tag) => (
          <Pill key={tag.id} label={tag.name} count={counts.get(tag.id) ?? 0} active={f.tagIds.includes(tag.id)}
            onToggle={() => toggle(tag.id)} onDelete={() => del(tag.id, tag.name)} />
        ))}
        <button type="button" className="pill add" aria-label={t('sidebar.addTag')} aria-expanded={addOpen}
          onClick={() => setAddOpen((o) => !o)}>
          {t('editor.newTag')}
        </button>
      </div>
      {addOpen && <AddTagForm onCreated={() => setAddOpen(false)} onCancel={() => setAddOpen(false)} />}
    </section>
  )
}
