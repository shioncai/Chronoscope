import { useState } from 'react'
import {
  useAppStore,
  useAppState,
  flattenCategoryTree,
  moveConflicts,
  dedupeTargetMovers,
  type RestoreConflict,
} from '../../state'
import { MoveMenu } from '../shell/MoveMenu'
import { TagMenu } from './TagMenu'
import { EventConflictDialog, type EventConflictItem } from '../shell/EventConflictDialog'
import type { Id } from '../../domain/model'

type OpenMenu = 'folder' | 'addTag' | 'removeTag' | null

// Batch action bar for the list view's checkbox selection. Reads the
// selection from the store and calls the store's batch ops directly
// (same pattern as the Sidebar). Renders nothing when nothing is checked.
export function BatchBar({ trash = false }: { trash?: boolean }) {
  const app = useAppStore()
  const state = useAppState()
  const ids = state.checkedIds
  const [open, setOpen] = useState<OpenMenu>(null)
  const [restoreConflicts, setRestoreConflicts] = useState<EventConflictItem[]>([])
  const [moveCtx, setMoveCtx] = useState<{ target: Id | null; items: EventConflictItem[] } | null>(null)

  // restoreEvents()/deleteEvents() drop every requested id from checkedIds
  // regardless of whether it conflicted (the selection was "consumed"), so once
  // a conflict dialog is pending, ids.length alone can no longer gate rendering
  // — keep the bar mounted while either a restore or a move dialog is open.
  if (ids.length === 0 && restoreConflicts.length === 0 && !moveCtx) return null

  // Recycle-bin selection: restore / permanent-delete instead of move/tag/delete.
  if (trash) {
    const purge = () => {
      if (window.confirm(`永久删除选中的 ${ids.length} 个事件？此操作不可撤销。`)) void app.purgeEvents(ids)
    }
    const toItems = (conflicts: RestoreConflict[]): EventConflictItem[] =>
      conflicts.map((c) => ({
        incoming: state.events.find((e) => e.id === c.eventId)!,
        existing: state.events.find((e) => e.id === c.existingId)!,
      }))
    const restore = async () => {
      const { conflicts } = await app.restoreEvents(ids)
      if (conflicts.length) setRestoreConflicts(toItems(conflicts))
    }
    const resolveRestore = async (choices: Record<Id, 'overwrite' | 'skip'>) => {
      const ids2 = Object.keys(choices)
      setRestoreConflicts([])
      await app.restoreEvents(ids2, choices)
    }
    return (
      <>
        <div className="batch-bar">
          <span className="bb-count">
            已选 <b>{ids.length}</b> 项
          </span>
          <span className="bb-sep" />
          <button type="button" className="bb-btn" onClick={() => void restore()}>
            恢复
          </button>
          <button type="button" className="bb-btn danger" onClick={purge}>
            永久删除
          </button>
          <span className="bb-sep" />
          <button type="button" className="bb-cancel" aria-label="取消选择" onClick={() => app.setChecked([])}>
            ✕
          </button>
        </div>
        {restoreConflicts.length > 0 && (
          <EventConflictDialog
            title="恢复冲突"
            conflicts={restoreConflicts}
            onResolve={(choices) => void resolveRestore(choices)}
            onCancel={() => setRestoreConflicts([])}
          />
        )}
      </>
    )
  }

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

  // Moving into a folder that already holds a live same-title event would
  // create two "files" at the same (title, folder). Route those through the
  // conflict dialog; non-colliding moves apply immediately.
  const move = (parentId: Id | null) => {
    setOpen(null)
    const conflicts = moveConflicts(state.events, ids, parentId)
    if (conflicts.length === 0) {
      // Even with no cross-selection conflict, two same-title movers could still
      // collide with each other in the target — dedupe (keep-first) before applying.
      void app.setEventsCategory(dedupeTargetMovers(state.events, ids, parentId), parentId)
      return
    }
    setMoveCtx({
      target: parentId,
      items: conflicts.map((c) => ({
        incoming: state.events.find((e) => e.id === c.movingId)!,
        existing: state.events.find((e) => e.id === c.existingId)!,
      })),
    })
  }
  const resolveMove = async (choices: Record<Id, 'overwrite' | 'skip'>) => {
    const ctx = moveCtx!
    setMoveCtx(null)
    const conflictIds = new Set(ctx.items.map((i) => i.incoming.id))
    const superseded = ctx.items.filter((i) => choices[i.incoming.id] === 'overwrite').map((i) => i.existing.id)
    // move everything selected except events the user chose to skip
    const toMove = ids.filter((id) => !conflictIds.has(id) || choices[id] !== 'skip')
    // 'overwrite': the moved event wins completely; the existing occupant is
    // permanently removed (not sent to the recycle bin).
    if (superseded.length) await app.purgeEvents(superseded)
    // Final dedupe guard: two same-title movers, or a mover vs a same-title
    // occupant that stays, must not both land. Superseded occupants free their
    // title (they're permanently removed), so overwrite replacements can move in.
    await app.setEventsCategory(
      dedupeTargetMovers(state.events, toMove, ctx.target, new Set(superseded)),
      ctx.target,
    )
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
    <>
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
      {moveCtx && (
        <EventConflictDialog
          title="移动冲突"
          conflicts={moveCtx.items}
          onResolve={(choices) => void resolveMove(choices)}
          onCancel={() => setMoveCtx(null)}
        />
      )}
    </>
  )
}
