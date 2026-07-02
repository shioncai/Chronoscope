import { useState } from 'react'
import { useAppStore, useAppState, flattenCategoryTree } from '../../state'
import { MoveMenu } from '../shell/MoveMenu'
import { TagMenu } from './TagMenu'
import type { Id } from '../../domain/model'

type OpenMenu = 'folder' | 'addTag' | 'removeTag' | null

// Batch action bar for the list view's checkbox selection. Reads the
// selection from the store and calls the store's batch ops directly
// (same pattern as the Sidebar). Renders nothing when nothing is checked.
export function BatchBar() {
  const app = useAppStore()
  const state = useAppState()
  const ids = state.checkedIds
  const [open, setOpen] = useState<OpenMenu>(null)

  if (ids.length === 0) return null

  const toggle = (m: Exclude<OpenMenu, null>) => setOpen((cur) => (cur === m ? null : m))

  const folders = flattenCategoryTree(state.categories)
  const allTags = state.tags.filter((t) => !t.deleted)

  // tags actually present on at least one selected event — the remove menu's
  // options (listing every tag would be noise).
  const idSet = new Set(ids)
  const present = new Set<Id>()
  for (const e of state.events) {
    if (idSet.has(e.id)) for (const tid of e.tagIds) present.add(tid)
  }
  const removableTags = allTags.filter((t) => present.has(t.id))

  const move = (parentId: Id | null) => {
    void app.setEventsCategory(ids, parentId)
    setOpen(null)
  }
  const addTag = (tagId: Id) => {
    void app.addTagToEvents(ids, tagId)
    setOpen(null)
  }
  const removeTag = (tagId: Id) => {
    void app.removeTagFromEvents(ids, tagId)
    setOpen(null)
  }
  const del = () => {
    if (window.confirm(`删除选中的 ${ids.length} 个事件?`)) void app.deleteEvents(ids)
  }

  return (
    <div className="batch-bar">
      <span className="bb-count">
        已选 <b>{ids.length}</b> 项
      </span>
      <span className="bb-sep" />
      <span className="menu-anchor">
        <button
          type="button"
          className="bb-btn"
          aria-haspopup="menu"
          aria-expanded={open === 'folder'}
          onClick={() => toggle('folder')}
        >
          移动到文件夹 ▾
        </button>
        {open === 'folder' && <MoveMenu targets={folders} topLabel="未分类" onMove={move} />}
      </span>
      <span className="menu-anchor">
        <button
          type="button"
          className="bb-btn"
          aria-haspopup="menu"
          aria-expanded={open === 'addTag'}
          onClick={() => toggle('addTag')}
        >
          添加标签 ▾
        </button>
        {open === 'addTag' && <TagMenu tags={allTags} onPick={addTag} />}
      </span>
      <span className="menu-anchor">
        <button
          type="button"
          className="bb-btn"
          aria-haspopup="menu"
          aria-expanded={open === 'removeTag'}
          onClick={() => toggle('removeTag')}
        >
          移除标签 ▾
        </button>
        {open === 'removeTag' && <TagMenu tags={removableTags} onPick={removeTag} />}
      </span>
      <button type="button" className="bb-btn danger" onClick={del}>
        删除
      </button>
      <span className="bb-sep" />
      <button type="button" className="bb-cancel" aria-label="取消选择" onClick={() => app.setChecked([])}>
        ✕
      </button>
    </div>
  )
}
