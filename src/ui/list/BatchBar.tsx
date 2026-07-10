import { useState } from 'react'
import {
  useAppStore,
  useAppState,
  flattenCategoryTree,
  type RestoreConflict,
} from '../../state'
import { MoveMenu } from '../shell/MoveMenu'
import { TagMenu } from './TagMenu'
import { EventConflictDialog, type EventConflictItem } from '../shell/EventConflictDialog'
import { useEventMove } from '../shell/useEventMove'
import { useT, useTn } from '../../i18n/useT'
import type { Id } from '../../domain/model'

type OpenMenu = 'folder' | 'addTag' | 'removeTag' | null

// Batch action bar for the list view's checkbox selection. Reads the
// selection from the store and calls the store's batch ops directly
// (same pattern as the Sidebar). Renders nothing when nothing is checked.
export function BatchBar({ trash = false }: { trash?: boolean }) {
  const app = useAppStore()
  const state = useAppState()
  const t = useT()
  const tn = useTn()
  const ids = state.checkedIds
  const [open, setOpen] = useState<OpenMenu>(null)
  const [restoreConflicts, setRestoreConflicts] = useState<EventConflictItem[]>([])
  const { move: moveEvents, dialog: moveDialog } = useEventMove()

  // restoreEvents()/deleteEvents() drop every requested id from checkedIds
  // regardless of whether it conflicted (the selection was "consumed"), so once
  // a restore conflict dialog is pending, ids.length alone can no longer gate
  // rendering — keep the bar mounted while a restore dialog is open.
  if (ids.length === 0 && restoreConflicts.length === 0) return null

  // Recycle-bin selection: restore / permanent-delete instead of move/tag/delete.
  if (trash) {
    const purge = () => {
      if (window.confirm(tn('list.purgeConfirm', ids.length))) void app.purgeEvents(ids)
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
          <span className="bb-count">{t('list.selectedCount', { n: ids.length })}</span>
          <span className="bb-sep" />
          <button type="button" className="bb-btn" onClick={() => void restore()}>
            {t('common.restore')}
          </button>
          <button type="button" className="bb-btn danger" onClick={purge}>
            {t('common.purge')}
          </button>
          <span className="bb-sep" />
          <button
            type="button"
            className="bb-cancel"
            aria-label={t('list.clearSelection')}
            onClick={() => app.setChecked([])}
          >
            ✕
          </button>
        </div>
        {restoreConflicts.length > 0 && (
          <EventConflictDialog
            title={t('conflict.restoreTitle')}
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
  // create two "files" at the same (title, folder). useEventMove routes those
  // through the conflict dialog; non-colliding moves apply immediately.
  const move = (parentId: Id | null) => {
    setOpen(null)
    moveEvents(ids, parentId)
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
    if (window.confirm(tn('list.deleteConfirm', ids.length))) void app.deleteEvents(ids)
  }

  return (
    <>
      <div className="batch-bar">
        <span className="bb-count">{t('list.selectedCount', { n: ids.length })}</span>
        <span className="bb-sep" />
        <span className="menu-anchor">
          <button
            type="button"
            className="bb-btn"
            aria-haspopup="menu"
            aria-expanded={open === 'folder'}
            onClick={() => toggle('folder')}
          >
            {t('list.moveToFolder')}
          </button>
          {open === 'folder' && (
            <MoveMenu targets={folders} topLabel={t('common.uncategorized')} onMove={move} />
          )}
        </span>
        <span className="menu-anchor">
          <button
            type="button"
            className="bb-btn"
            aria-haspopup="menu"
            aria-expanded={open === 'addTag'}
            onClick={() => toggle('addTag')}
          >
            {t('list.addTag')}
          </button>
          {open === 'addTag' && <TagMenu tags={allTags} onPick={addTag} emptyLabel={t('list.noTags')} />}
        </span>
        <span className="menu-anchor">
          <button
            type="button"
            className="bb-btn"
            aria-haspopup="menu"
            aria-expanded={open === 'removeTag'}
            onClick={() => toggle('removeTag')}
          >
            {t('list.removeTag')}
          </button>
          {open === 'removeTag' && (
            <TagMenu tags={removableTags} onPick={removeTag} emptyLabel={t('list.noTags')} />
          )}
        </span>
        <button type="button" className="bb-btn danger" onClick={del}>
          {t('common.delete')}
        </button>
        <span className="bb-sep" />
        <button
          type="button"
          className="bb-cancel"
          aria-label={t('list.clearSelection')}
          onClick={() => app.setChecked([])}
        >
          ✕
        </button>
      </div>
      {moveDialog}
    </>
  )
}
