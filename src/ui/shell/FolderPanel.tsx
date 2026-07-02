import { useState } from 'react'
import {
  useAppStore, useAppState, buildCategoryTree, categoryEventCounts,
  descendantCategoryIds, computeDropTarget, type CategoryNode,
} from '../../state'
import type { Id } from '../../domain/model'
import { CATEGORY_PRESETS, loadCustomColors, persistCustomColors, addToPalette } from '../categoryColors'
import { ColorPicker } from './ColorPicker'
import { AddFolderForm } from './AddFolderForm'

// 把可见树拍平成有序行，带 depth，用于拖拽落点计算
interface FlatRow { id: Id; depth: number; parentId: Id | null; hasChildren: boolean }
function flattenVisible(nodes: CategoryNode[], collapsed: Set<Id>, depth = 0, out: FlatRow[] = []): FlatRow[] {
  for (const n of nodes) {
    const hasChildren = n.children.length > 0
    out.push({ id: n.category.id, depth, parentId: n.category.parentId, hasChildren })
    if (hasChildren && !collapsed.has(n.category.id)) flattenVisible(n.children, collapsed, depth + 1, out)
  }
  return out
}

export function FolderPanel() {
  const app = useAppStore()
  const state = useAppState()
  const tree = buildCategoryTree(state.categories)
  const counts = categoryEventCounts(state)
  const live = state.categories.filter((c) => !c.deleted)
  const liveEvents = state.events.filter((e) => !e.deleted)

  const [collapsed, setCollapsed] = useState<Set<Id>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [colorFor, setColorFor] = useState<Id | null>(null)
  const [custom, setCustom] = useState<string[]>(() => loadCustomColors(window.localStorage))
  const [dragId, setDragId] = useState<Id | null>(null)
  const [drop, setDrop] = useState<{ id: Id; mode: 'before' | 'after' | 'into' } | null>(null)
  const [renaming, setRenaming] = useState<Id | null>(null)
  const [renameVal, setRenameVal] = useState('')

  const startRename = (id: Id, name: string) => { setColorFor(null); setRenameVal(name); setRenaming(id) }
  const commitRename = () => {
    if (renaming) {
      const n = renameVal.trim()
      if (n) void app.updateCategory(renaming, { name: n })
    }
    setRenaming(null)
  }

  const rows = flattenVisible(tree, collapsed)
  const byId = new Map(live.map((c) => [c.id, c]))

  const toggle = (id: Id) => setCollapsed((p) => {
    const n = new Set(p)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const pick = (id: Id) => app.setFilter({ categoryId: state.filter.categoryId === id ? null : id, uncategorized: false, untagged: false, trash: false })
  const del = (id: Id, name: string) => {
    const ids = descendantCategoryIds(state.categories, id)
    const n = liveEvents.filter((e) => e.categoryId != null && ids.has(e.categoryId)).length
    const msg = n > 0 ? `删除文件夹「${name}」会同时删除其下 ${n} 个事件（含子文件夹），不可撤销。确定？` : `删除文件夹「${name}」？`
    if (!window.confirm(msg)) return
    app.deleteCategory(id)
    if (state.filter.categoryId != null && ids.has(state.filter.categoryId)) app.setFilter({ categoryId: null })
  }

  const onDrop = () => {
    if (dragId && drop) {
      const { parentId, beforeId } = computeDropTarget(state.categories, dragId, drop.id, drop.mode)
      void app.moveCategory(dragId, parentId, beforeId)
    }
    setDragId(null); setDrop(null)
  }

  return (
    <section className="module">
      <div className="module-head">
        <h2>文件夹</h2>
        <button type="button" className="head-btn" aria-label="添加文件夹" aria-expanded={addOpen}
          onClick={() => setAddOpen((o) => !o)}>＋</button>
      </div>
      {addOpen && (
        <AddFolderForm defaultParentId={state.filter.categoryId ?? null}
          onCreated={() => setAddOpen(false)} onCancel={() => setAddOpen(false)} />
      )}
      <div className="folder-list" onDragEnd={() => { setDragId(null); setDrop(null) }}>
        {rows.map((row) => {
          const c = byId.get(row.id)!
          const cls = ['folder-row']
          if (state.filter.categoryId === row.id) cls.push('active')
          if (drop?.id === row.id) cls.push(`drop-${drop.mode}`)
          if (dragId === row.id) cls.push('dragging')
          return (
            <div key={row.id} className={cls.join(' ')} draggable
              style={{ paddingLeft: 8 + row.depth * 16 }}
              onDragStart={() => setDragId(row.id)}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragId === row.id) return
                const r = e.currentTarget.getBoundingClientRect()
                const y = e.clientY - r.top
                const mode = y < r.height * 0.3 ? 'before' : y > r.height * 0.7 ? 'after' : 'into'
                setDrop({ id: row.id, mode })
              }}
              onDrop={onDrop}>
              {row.hasChildren ? (
                <button type="button" className={collapsed.has(row.id) ? 'twisty collapsed' : 'twisty'}
                  aria-label={`${collapsed.has(row.id) ? '展开' : '折叠'}「${c.name}」`} aria-expanded={!collapsed.has(row.id)}
                  onClick={() => toggle(row.id)}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4,6 8,10 12,6" /></svg>
                </button>
              ) : <span className="twisty-spacer" />}
              <button type="button" className="color-dot" style={{ background: c.color }}
                aria-label={`设置「${c.name}」颜色`} onClick={() => setColorFor((cur) => cur === row.id ? null : row.id)} />
              {renaming === row.id ? (
                <input
                  className="rename-input"
                  aria-label={`重命名「${c.name}」`}
                  value={renameVal}
                  autoFocus
                  draggable={false}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onDragStart={(e) => e.preventDefault()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    else if (e.key === 'Escape') setRenaming(null)
                  }}
                  onBlur={commitRename}
                />
              ) : (
                <button type="button" className="label" onClick={() => pick(row.id)}
                  onDoubleClick={() => startRename(row.id, c.name)} title={c.name}>{c.name}</button>
              )}
              <span className="count">{counts.get(row.id) ?? 0}</span>
              <span className="row-actions">
                <button type="button" className="rename" aria-label={`重命名文件夹「${c.name}」`}
                  onClick={() => startRename(row.id, c.name)}>✎</button>
                <button type="button" className="del" aria-label={`删除文件夹「${c.name}」`} onClick={() => del(row.id, c.name)}>×</button>
              </span>
              {colorFor === row.id && (
                <div className="dot-picker">
                  <ColorPicker value={c.color} presets={CATEGORY_PRESETS} custom={custom}
                    onPick={(hex) => { void app.updateCategory(row.id, { color: hex }); setColorFor(null) }}
                    onAddCustom={(hex) => { const n = addToPalette(custom, hex); setCustom(n); persistCustomColors(window.localStorage, n) }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
