import { useState } from 'react'
import {
  useAppStore,
  useAppState,
  flattenCategoryTree,
  type RestoreConflict,
} from '../../state'
import { MoveMenu } from '../components/MoveMenu'
import { TagMenu } from './TagMenu'
import { EventConflictDialog, type EventConflictItem } from '../dialogs/EventConflictDialog'
import { useEventMove } from '../hooks/useEventMove'
import { useT, useTn } from '../../i18n/useT'
import type { Id } from '../../domain/model'

type OpenMenu = 'folder' | 'addTag' | 'removeTag' | null

// The bar's actions carry an icon as well as a label, because on a phone the
// labels are dropped (see the media query in chrome.css) and the icon is all
// that is left: it is what lets four actions and a count sit on one row at any
// width, in either language. The accessible name always comes from aria-label,
// so hiding the text costs nothing.
const svg = { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const FolderIcon = () => (
  <svg {...svg} aria-hidden="true">
    <path d="M1.8 12.6V3.9a.9.9 0 0 1 .9-.9h2.9l1.4 1.8h6.3a.9.9 0 0 1 .9.9v6.9a.9.9 0 0 1-.9.9H2.7a.9.9 0 0 1-.9-.9Z" />
  </svg>
)
// a tag, with the sign that says which way it goes
const TagIcon = ({ sign }: { sign: 'plus' | 'minus' }) => (
  <svg {...svg} aria-hidden="true">
    <path d="M6.9 1.6h3.4a.9.9 0 0 1 .9.9V6a.9.9 0 0 1-.27.64l-4.5 4.5a.9.9 0 0 1-1.27 0L1.5 7.44a.9.9 0 0 1 0-1.27l4.5-4.5a.9.9 0 0 1 .64-.27Z" />
    <circle cx="8.9" cy="4" r=".85" />
    <line x1="10.4" y1="12.6" x2="14.4" y2="12.6" />
    {sign === 'plus' && <line x1="12.4" y1="10.6" x2="12.4" y2="14.6" />}
  </svg>
)
const TrashIcon = () => (
  <svg {...svg} aria-hidden="true">
    <line x1="2.4" y1="4" x2="13.6" y2="4" />
    <path d="M5.6 4V2.4h4.8V4" />
    <path d="M3.9 4v9.1a.9.9 0 0 0 .9.9h6.4a.9.9 0 0 0 .9-.9V4" />
    <line x1="6.6" y1="6.6" x2="6.6" y2="11.4" />
    <line x1="9.4" y1="6.6" x2="9.4" y2="11.4" />
  </svg>
)
const RestoreIcon = () => (
  <svg {...svg} aria-hidden="true">
    <path d="M2.8 8a5.2 5.2 0 1 0 1.6-3.75" />
    <polyline points="2.1,2.2 2.1,5.6 5.5,5.6" />
  </svg>
)
const Caret = () => <span className="bb-caret" aria-hidden="true">▾</span>

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
          <button type="button" className="bb-btn" aria-label={t('common.restore')} onClick={() => void restore()}>
            <RestoreIcon />
            <span className="bb-label">{t('common.restore')}</span>
          </button>
          <button type="button" className="bb-btn danger" aria-label={t('common.purge')} onClick={purge}>
            <TrashIcon />
            <span className="bb-label">{t('common.purge')}</span>
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
            aria-label={t('list.moveToFolder')}
            onClick={() => toggle('folder')}
          >
            <FolderIcon />
            <span className="bb-label">{t('list.moveToFolder')}</span>
            <Caret />
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
            aria-label={t('list.addTag')}
            onClick={() => toggle('addTag')}
          >
            <TagIcon sign="plus" />
            <span className="bb-label">{t('list.addTag')}</span>
            <Caret />
          </button>
          {open === 'addTag' && <TagMenu tags={allTags} onPick={addTag} emptyLabel={t('list.noTags')} />}
        </span>
        <span className="menu-anchor">
          <button
            type="button"
            className="bb-btn"
            aria-haspopup="menu"
            aria-expanded={open === 'removeTag'}
            aria-label={t('list.removeTag')}
            onClick={() => toggle('removeTag')}
          >
            <TagIcon sign="minus" />
            <span className="bb-label">{t('list.removeTag')}</span>
            <Caret />
          </button>
          {open === 'removeTag' && (
            <TagMenu tags={removableTags} onPick={removeTag} emptyLabel={t('list.noTags')} />
          )}
        </span>
        <button type="button" className="bb-btn danger" aria-label={t('common.delete')} onClick={del}>
          <TrashIcon />
          <span className="bb-label">{t('common.delete')}</span>
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
