import { Fragment, useRef, useState } from 'react'
import {
  useAppStore, useAppState, buildCategoryTree, categoryEventCounts,
  descendantCategoryIds, computeDropTarget, liveFolderAt,
  memberEventIds, folderCheckStates, toggleFolder, toggleEvent, soloFolder,
  type CategoryNode,
} from '../../state'
import type { Id, EventRecord } from '../../domain/model'
import type { Locale } from '../../domain/locale'
import { formatTimePointShort, instantOf } from '../../domain/time'
import { ColorPicker } from './ColorPicker'
import { AddFolderForm } from './AddFolderForm'
import { Checkbox } from './Checkbox'
import { useEventMove } from './useEventMove'
import { useT, useTn, useLocale } from '../../i18n/useT'

type Row =
  | { kind: 'folder'; id: Id; depth: number; parentId: Id | null; node: CategoryNode; hasChildren: boolean }
  | { kind: 'event'; id: Id; depth: number; event: EventRecord }

const anchor = (e: EventRecord): number =>
  e.start ? instantOf(e.start) : e.end ? instantOf(e.end) : Number.POSITIVE_INFINITY

// 展开的文件夹：先递归子文件夹（手动 order），再追加其直属事件（起始时间升序）。
function buildRows(
  nodes: CategoryNode[], eventsByCat: Map<Id, EventRecord[]>, expanded: Set<Id>, depth = 0, out: Row[] = [],
): Row[] {
  for (const n of nodes) {
    const evs = (eventsByCat.get(n.category.id) ?? []).slice().sort((a, b) => anchor(a) - anchor(b))
    const hasChildren = n.children.length > 0 || evs.length > 0
    out.push({ kind: 'folder', id: n.category.id, depth, parentId: n.category.parentId, node: n, hasChildren })
    if (hasChildren && expanded.has(n.category.id)) {
      buildRows(n.children, eventsByCat, expanded, depth + 1, out)
      for (const e of evs) out.push({ kind: 'event', id: e.id, depth: depth + 1, event: e })
    }
  }
  return out
}

// The short form, not the prose: a tree row is barely 160px wide once the folder
// indent is paid for, and the title has first claim on it.
const eventTime = (e: EventRecord, locale: Locale): string =>
  e.start
    ? formatTimePointShort(e.start, locale)
    : e.end
      ? formatTimePointShort(e.end, locale)
      : '—'

export interface FolderPanelProps {
  onEdit: (id: Id) => void
}

export function FolderPanel({ onEdit }: FolderPanelProps) {
  const app = useAppStore()
  const state = useAppState()
  const t = useT()
  const tn = useTn()
  const locale = useLocale()
  const tree = buildCategoryTree(state.categories)
  const counts = categoryEventCounts(state)
  const live = state.categories.filter((c) => !c.deleted)
  const liveEvents = state.events.filter((e) => !e.deleted)

  const [expanded, setExpanded] = useState<Set<Id>>(new Set()) // 默认全折叠
  const [addOpen, setAddOpen] = useState(false)
  const [colorFor, setColorFor] = useState<Id | null>(null)
  const colorDotRef = useRef<HTMLButtonElement>(null)
  const [dragId, setDragId] = useState<Id | null>(null)
  const [drop, setDrop] = useState<{ id: Id; mode: 'before' | 'after' | 'into' } | null>(null)
  const [tailOver, setTailOver] = useState(false)
  const [renaming, setRenaming] = useState<Id | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [renameError, setRenameError] = useState('')
  // event drag-to-reparent
  const { move: moveEvent, dialog: moveDialog } = useEventMove()
  const [dragKind, setDragKind] = useState<'folder' | 'event' | null>(null)
  const [dropFolderId, setDropFolderId] = useState<Id | null>(null) // 事件拖拽的落点高亮
  const springRef = useRef<{ id: Id; timer: ReturnType<typeof setTimeout> } | null>(null)
  const cancelSpring = () => { if (springRef.current) { clearTimeout(springRef.current.timer); springRef.current = null } }
  // 弹簧式展开：拖着事件在折叠文件夹上停留一会儿才展开，避免路过全展开。
  const armSpring = (id: Id) => {
    if (springRef.current?.id === id) return
    cancelSpring()
    springRef.current = { id, timer: setTimeout(() => { setExpanded((p) => new Set(p).add(id)); springRef.current = null }, 600) }
  }
  const endDrag = () => { setDragId(null); setDrop(null); setTailOver(false); setDragKind(null); setDropFolderId(null); cancelSpring() }

  const scope = state.filter.scope
  const members = memberEventIds(scope, state.categories, state.events)
  const checkStates = folderCheckStates(state.categories, state.events, members, new Set(scope.folderIds))

  const eventsByCat = new Map<Id, EventRecord[]>()
  for (const e of liveEvents) {
    if (e.categoryId == null) continue
    const arr = eventsByCat.get(e.categoryId) ?? []
    arr.push(e)
    eventsByCat.set(e.categoryId, arr)
  }
  const rows = buildRows(tree, eventsByCat, expanded)
  const byId = new Map(live.map((c) => [c.id, c]))

  const clearModes = { uncategorized: false, untagged: false, trash: false }
  const solo = (id: Id) => app.setFilter({ scope: soloFolder(id), ...clearModes })
  const toggleFolderScope = (id: Id) =>
    app.setFilter({ scope: toggleFolder(scope, id, state.categories, state.events), ...clearModes })
  const toggleEventScope = (e: EventRecord) =>
    app.setFilter({ scope: toggleEvent(scope, e, state.categories), ...clearModes })

  const toggleExpand = (id: Id) => setExpanded((p) => {
    const n = new Set(p)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const startRename = (id: Id, name: string) => { setColorFor(null); setRenameVal(name); setRenaming(id); setRenameError('') }
  const commitRename = () => {
    if (renaming) {
      const n = renameVal.trim()
      if (n) {
        const self = state.categories.find((c) => c.id === renaming)
        if (self && liveFolderAt(state.categories, n, self.parentId, renaming)) {
          setRenameError(t('sidebar.renameDuplicate'))
          return
        }
        void app.updateCategory(renaming, { name: n })
      }
    }
    setRenaming(null)
    setRenameError('')
  }

  const del = (id: Id, name: string) => {
    const ids = descendantCategoryIds(state.categories, id)
    const n = liveEvents.filter((e) => e.categoryId != null && ids.has(e.categoryId)).length
    const msg = n > 0
      ? tn('sidebar.deleteFolderConfirm', n, { name })
      : t('sidebar.deleteFolderConfirmEmpty', { name })
    if (!window.confirm(msg)) return
    app.deleteCategory(id)
    const evGone = new Set(liveEvents.filter((e) => e.categoryId != null && ids.has(e.categoryId)).map((e) => e.id))
    app.setFilter({ scope: {
      folderIds: scope.folderIds.filter((f) => !ids.has(f)),
      includeEvents: scope.includeEvents.filter((i) => !evGone.has(i)),
      excludeEvents: scope.excludeEvents.filter((i) => !evGone.has(i)),
    } })
  }

  const onDrop = () => {
    if (dragId && drop) {
      const { parentId, beforeId } = computeDropTarget(state.categories, dragId, drop.id, drop.mode)
      const drag = state.categories.find((c) => c.id === dragId)
      if (!(drag && liveFolderAt(state.categories, drag.name, parentId, dragId))) {
        void app.moveCategory(dragId, parentId, beforeId)
      }
    }
    endDrag()
  }
  const onTailDrop = () => {
    if (dragKind === 'event') { endDrag(); return } // 事件拖到文件夹外 = 无操作
    if (dragId) {
      const drag = state.categories.find((c) => c.id === dragId)
      if (!(drag && liveFolderAt(state.categories, drag.name, null, dragId))) {
        void app.moveCategory(dragId, null, null)
      }
    }
    endDrag()
  }

  return (
    <section className="module">
      <div className="module-head">
        <h2>{t('sidebar.folders')}</h2>
        <button type="button" className="head-btn" aria-label={t('sidebar.addFolder')} aria-expanded={addOpen}
          onClick={() => setAddOpen((o) => !o)}>＋</button>
      </div>
      {addOpen && (
        <AddFolderForm defaultParentId={
            scope.folderIds.length === 1 && scope.includeEvents.length === 0 ? scope.folderIds[0] : null
          }
          onCreated={() => setAddOpen(false)} onCancel={() => setAddOpen(false)} />
      )}
      <div className={dragId != null ? 'folder-list dragging' : 'folder-list'}
        onDragEnd={endDrag}>
        {rows.map((row) => {
          if (row.kind === 'event') {
            const e = row.event
            const checked = members.has(e.id)
            return (
              <div key={`e-${row.id}`} className="event-row" draggable
                style={{ paddingLeft: 8 + row.depth * 16 }}
                onDragStart={(ev) => { ev.stopPropagation(); setDragId(e.id); setDragKind('event') }}>
                <span className="twisty-spacer" />
                <Checkbox state={checked ? 'checked' : 'unchecked'} label={t('common.selectEvent', { title: e.title })} onClick={() => toggleEventScope(e)} />
                {/* 打开编辑器的点击区从事件名开始往右，避开旁边的小复选框 */}
                <button type="button" className="ev-main" title={e.title}
                  onClick={() => { app.select(e.id); onEdit(e.id) }}>
                  <span className="ev-label">{e.title}</span>
                  <span className="ev-time mono">{eventTime(e, locale)}</span>
                </button>
              </div>
            )
          }
          const c = byId.get(row.id)!
          const fstate = checkStates.get(row.id) ?? 'unchecked'
          const cls = ['folder-row']
          if (drop?.id === row.id) cls.push(`drop-${drop.mode}`)
          if (dragKind === 'event' && dropFolderId === row.id) cls.push('drop-into')
          if (dragId === row.id) cls.push('dragging')
          return (
            <Fragment key={`f-${row.id}`}>
              <div className={cls.join(' ')} draggable
                style={{ paddingLeft: 8 + row.depth * 16 }}
                onDragStart={() => { setDragId(row.id); setDragKind('folder') }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragKind === 'event') {
                    setDropFolderId(row.id)
                    if (!expanded.has(row.id) && row.hasChildren) armSpring(row.id)
                    else cancelSpring()
                    return
                  }
                  if (dragId === row.id) return
                  const r = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - r.top
                  const mode = y < r.height * 0.3 ? 'before' : y > r.height * 0.7 ? 'after' : 'into'
                  setDrop({ id: row.id, mode })
                  setTailOver(false)
                }}
                onDrop={() => {
                  if (dragKind === 'event' && dragId) {
                    const moving = liveEvents.find((x) => x.id === dragId)
                    if (moving && moving.categoryId !== row.id) moveEvent([dragId], row.id)
                    endDrag()
                    return
                  }
                  onDrop()
                }}>
                {row.hasChildren ? (
                  <button type="button" className={expanded.has(row.id) ? 'twisty' : 'twisty collapsed'}
                    aria-label={t(expanded.has(row.id) ? 'sidebar.collapse' : 'sidebar.expand', { name: c.name })} aria-expanded={expanded.has(row.id)}
                    onClick={(e) => { e.stopPropagation(); toggleExpand(row.id) }}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4,6 8,10 12,6" /></svg>
                  </button>
                ) : <span className="twisty-spacer" />}
                <Checkbox state={fstate} label={t('sidebar.selectFolder', { name: c.name })} onClick={() => toggleFolderScope(row.id)} />
                <button type="button" className="color-dot" style={{ background: c.color }} data-picker-trigger
                  ref={colorFor === row.id ? colorDotRef : null}
                  aria-label={t('sidebar.setColor', { name: c.name })} onClick={(e) => { e.stopPropagation(); setColorFor((cur) => cur === row.id ? null : row.id) }} />
                {renaming === row.id ? (
                  <input className="rename-input" aria-label={t('sidebar.rename', { name: c.name })} value={renameVal} autoFocus draggable={false}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onDragStart={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      else if (e.key === 'Escape') { setRenaming(null); setRenameError('') }
                    }}
                    onBlur={commitRename} />
                ) : (
                  <button type="button" className="label" onClick={() => solo(row.id)}
                    onDoubleClick={() => startRename(row.id, c.name)} title={c.name}>{c.name}</button>
                )}
                <span className="count">{counts.get(row.id) ?? 0}</span>
                <span className="row-actions">
                  <button type="button" className="rename" aria-label={t('sidebar.renameFolder', { name: c.name })}
                    onClick={(e) => { e.stopPropagation(); startRename(row.id, c.name) }}>✎</button>
                  <button type="button" className="del" aria-label={t('sidebar.deleteFolder', { name: c.name })} onClick={(e) => { e.stopPropagation(); del(row.id, c.name) }}>×</button>
                </span>
                {colorFor === row.id && (
                  <ColorPicker value={c.color} anchorRef={colorDotRef}
                    onPick={(hex) => { void app.updateCategory(row.id, { color: hex }); setColorFor(null) }}
                    onClose={() => setColorFor(null)} />
                )}
              </div>
              {renaming === row.id && renameError && (
                <div className="errors rename-err" style={{ marginLeft: 8 + row.depth * 16 }}>{renameError}</div>
              )}
            </Fragment>
          )
        })}
        <div className={tailOver ? 'folder-tail over' : 'folder-tail'} aria-hidden="true"
          onDragOver={(e) => { if (dragId == null) return; e.preventDefault(); setDrop(null); setTailOver(true) }}
          onDragLeave={() => setTailOver(false)}
          onDrop={onTailDrop} />
      </div>
      {moveDialog}
    </section>
  )
}
