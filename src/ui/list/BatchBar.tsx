import { useMemo, useRef, useState } from 'react'
import { useAppStore, useAppSelector, flattenCategoryTree, shallowEqual, type RestoreConflict } from '../../state'
import { EventConflictDialog, type EventConflictItem } from '../dialogs/EventConflictDialog'
import { useEventMove } from '../hooks/useEventMove'
import { Icon, type IconName } from '../components/Icon'
import { Popover, MenuItem } from '../components/Popover'
import { useConfirm } from '../components/useConfirm'
import { useToast } from '../components/useToast'
import { useT, useTn } from '../../i18n/useT'
import type { Id } from '../../domain/model'

type OpenMenu = 'folder' | 'addTag' | 'removeTag' | null

/**
 * Batch actions for the list's checkbox selection. On a phone the labels drop
 * and the icons carry the row (see list.css); the accessible name always comes
 * from aria-label, so hiding the text costs nothing.
 */
export function BatchBar({ trash = false }: { trash?: boolean }) {
  const app = useAppStore()
  const t = useT()
  const tn = useTn()
  const confirm = useConfirm()
  const toast = useToast()
  const { ids, events, categories, tags } = useAppSelector(
    (s) => ({ ids: s.checkedIds, events: s.events, categories: s.categories, tags: s.tags }),
    shallowEqual,
  )
  const [open, setOpen] = useState<OpenMenu>(null)
  const [restoreConflicts, setRestoreConflicts] = useState<EventConflictItem[]>([])
  const { move: moveEvents, dialog: moveDialog } = useEventMove()
  const folderRef = useRef<HTMLButtonElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const removeRef = useRef<HTMLButtonElement>(null)

  const folders = useMemo(() => flattenCategoryTree(categories), [categories])
  const liveTags = useMemo(() => tags.filter((x) => !x.deleted), [tags])
  // tags actually present on at least one selected event — the remove menu's
  // options (listing every tag would be noise).
  const removableTags = useMemo(() => {
    const idSet = new Set(ids)
    const present = new Set<Id>()
    for (const e of events) if (idSet.has(e.id)) for (const tid of e.tagIds) present.add(tid)
    return liveTags.filter((x) => present.has(x.id))
  }, [ids, events, liveTags])

  // restoreEvents()/deleteEvents() consume the requested ids from checkedIds
  // whether or not they conflicted, so keep the bar mounted while a restore
  // dialog is still open.
  if (ids.length === 0 && restoreConflicts.length === 0) return null

  const undoToast = (message: string) => toast({ message, action: { label: t('common.undo'), run: () => void app.undo() } })
  const toggle = (m: Exclude<OpenMenu, null>) => setOpen((cur) => (cur === m ? null : m))
  const btn = (icon: IconName, label: string, onClick: () => void, opts: { danger?: boolean; menu?: Exclude<OpenMenu, null>; ref?: React.RefObject<HTMLButtonElement | null> } = {}) => (
    <button type="button" ref={opts.ref} className={opts.danger ? 'bb-btn is-danger' : 'bb-btn'} aria-label={label} title={label}
      aria-haspopup={opts.menu ? 'menu' : undefined} aria-expanded={opts.menu ? open === opts.menu : undefined} onClick={onClick}>
      <Icon name={icon} size={16} />
      <span className="bb-label">{label}</span>
      {opts.menu && <Icon name="chevronDown" size={12} className="caret" />}
    </button>
  )
  const clear = (
    <button type="button" className="bb-cancel" aria-label={t('list.clearSelection')} title={`${t('list.clearSelection')} (Esc)`}
      onClick={() => app.setChecked([])}>
      <Icon name="close" size={16} />
    </button>
  )

  // Recycle-bin selection: restore / permanent-delete instead of move/tag/delete.
  if (trash) {
    const purge = async () => {
      const n = ids.length
      const ok = await confirm({ title: t('common.purge'), message: tn('list.purgeConfirm', n), confirmLabel: t('common.purge'), danger: true })
      if (!ok) return
      await app.purgeEvents(ids)
      undoToast(tn('toast.purged', n))
    }
    const toItems = (conflicts: RestoreConflict[]): EventConflictItem[] =>
      conflicts.map((c) => ({
        incoming: events.find((e) => e.id === c.eventId)!,
        existing: events.find((e) => e.id === c.existingId)!,
      }))
    const restore = async () => {
      const n = ids.length
      const { conflicts } = await app.restoreEvents(ids)
      if (conflicts.length) setRestoreConflicts(toItems(conflicts))
      else undoToast(tn('toast.restored', n))
    }
    const resolveRestore = async (choices: Record<Id, 'overwrite' | 'skip'>) => {
      setRestoreConflicts([])
      await app.restoreEvents(Object.keys(choices), choices)
    }
    return (
      <>
        {ids.length > 0 && (
          <div className="batch-bar" role="toolbar" aria-label={t('list.selectedCount', { n: ids.length })}>
            <span className="bb-count">{t('list.selectedCount', { n: ids.length })}</span>
            <span className="bb-sep" />
            {btn('restore', t('common.restore'), () => void restore())}
            {btn('trash', t('common.purge'), () => void purge(), { danger: true })}
            <span className="bb-sep" />
            {clear}
          </div>
        )}
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

  // Moving into a folder that already holds a live same-title event would
  // create two "files" at the same (title, folder). useEventMove routes those
  // through the conflict dialog; non-colliding moves apply immediately.
  const move = (parentId: Id | null) => {
    setOpen(null)
    moveEvents(ids, parentId)
  }
  const addTag = async (tagId: Id) => {
    setOpen(null)
    await app.addTagToEvents(ids, tagId)
  }
  const removeTag = async (tagId: Id) => {
    setOpen(null)
    await app.removeTagFromEvents(ids, tagId)
  }
  const del = async () => {
    const n = ids.length
    await app.deleteEvents(ids)
    undoToast(tn('toast.deleted', n))
  }

  return (
    <>
      <div className="batch-bar" role="toolbar" aria-label={t('list.selectedCount', { n: ids.length })}>
        <span className="bb-count">{t('list.selectedCount', { n: ids.length })}</span>
        <span className="bb-sep" />
        {btn('folder', t('list.moveToFolder'), () => toggle('folder'), { menu: 'folder', ref: folderRef })}
        {btn('tagPlus', t('list.addTag'), () => toggle('addTag'), { menu: 'addTag', ref: addRef })}
        {btn('tagMinus', t('list.removeTag'), () => toggle('removeTag'), { menu: 'removeTag', ref: removeRef })}
        {btn('trash', t('common.delete'), () => void del(), { danger: true })}
        <span className="bb-sep" />
        {clear}
      </div>
      {open === 'folder' && (
        <Popover anchorRef={folderRef} onClose={() => setOpen(null)} placement={['above', 'below']} className="popover--scroll" label={t('list.moveToFolder')}>
          <MenuItem onClick={() => move(null)}>
            <span className="menu-dot" />
            <span>{t('common.uncategorized')}</span>
          </MenuItem>
          {folders.map(({ category, depth }) => (
            <MenuItem key={category.id} onClick={() => move(category.id)}>
              <span className="menu-indent" style={{ width: depth * 12 }} />
              <span className="menu-dot" style={{ background: category.color }} />
              <span>{category.name}</span>
            </MenuItem>
          ))}
        </Popover>
      )}
      {(open === 'addTag' || open === 'removeTag') && (
        <Popover anchorRef={open === 'addTag' ? addRef : removeRef} onClose={() => setOpen(null)} placement={['above', 'below']}
          className="popover--scroll" label={t(open === 'addTag' ? 'list.addTag' : 'list.removeTag')}>
          {(open === 'addTag' ? liveTags : removableTags).length === 0 ? (
            <span className="menu-empty">{t('list.noTags')}</span>
          ) : (
            (open === 'addTag' ? liveTags : removableTags).map((x) => (
              <MenuItem key={x.id} onClick={() => void (open === 'addTag' ? addTag(x.id) : removeTag(x.id))}>
                <Icon name="hash" size={14} />
                <span>{x.name}</span>
              </MenuItem>
            ))
          )}
        </Popover>
      )}
      {moveDialog}
    </>
  )
}
