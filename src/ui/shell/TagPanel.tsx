import { useState } from 'react'
import { useAppStore, useAppState } from '../../state'
import type { Id } from '../../domain/model'
import { Pill } from './Pill'
import { AddTagForm } from './AddTagForm'

export function TagPanel() {
  const app = useAppStore()
  const state = useAppState()
  const tags = state.tags.filter((t) => !t.deleted)
  const f = state.filter
  const [addOpen, setAddOpen] = useState(false)

  const tagCount = (id: Id) => state.events.filter((e) => !e.deleted && e.tagIds.includes(id)).length
  const toggle = (id: Id) =>
    app.setFilter({ tagIds: f.tagIds.includes(id) ? f.tagIds.filter((x) => x !== id) : [...f.tagIds, id], untagged: false, trash: false })
  const del = (id: Id, name: string) => {
    if (!window.confirm(`删除标签「${name}」？`)) return
    app.deleteTag(id)
    if (f.tagIds.includes(id)) app.setFilter({ tagIds: f.tagIds.filter((x) => x !== id) })
  }

  return (
    <section className="module">
      <div className="module-head">
        <h2>标签</h2>
        <button type="button" className="logic-btn" aria-label="切换 与/或 逻辑"
          onClick={() => app.setFilter({ tagMode: f.tagMode === 'or' ? 'and' : 'or' })}>
          {f.tagMode === 'or' ? 'OR' : 'AND'}
        </button>
      </div>
      <div className="pills">
        {tags.map((t) => (
          <Pill key={t.id} label={t.name} count={tagCount(t.id)} active={f.tagIds.includes(t.id)}
            onToggle={() => toggle(t.id)} onDelete={() => del(t.id, t.name)} />
        ))}
        <button type="button" className="pill add" aria-label="添加标签" aria-expanded={addOpen}
          onClick={() => setAddOpen((o) => !o)}>
          ＋ 新标签
        </button>
      </div>
      {addOpen && <AddTagForm onCreated={() => setAddOpen(false)} onCancel={() => setAddOpen(false)} />}
    </section>
  )
}
