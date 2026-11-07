import { Fragment, useMemo, useRef, useState } from 'react'
import {
  useAppStore, useAppSelector, buildCategoryTree, categoryEventCounts,
  descendantCategoryIds, computeDropTarget, liveFolderAt,
  memberEventIds, folderCheckStates, toggleFolder, toggleEvent, soloFolder,
  type CategoryNode,
} from '../../state'
import type { Id, EventRecord } from '../../domain/model'
import type { Locale } from '../../domain/locale'
import { formatTimePointShort, instantOf } from '../../domain/time'
import { ColorPicker } from '../components/ColorPicker'
import { Checkbox } from '../components/Checkbox'
import { Icon } from '../components/Icon'
import { useConfirm } from '../components/useConfirm'
import { useToast } from '../components/useToast'
import { AddFolderForm } from './AddFolderForm'
import { useEventMove } from '../hooks/useEventMove'
import { useT, useTn, useLocale } from '../../i18n/useT'

type Row =
  | { kind: 'folder'; id: Id; depth: number; node: CategoryNode; hasChildren: boolean }
  | { kind: 'event'; id: Id; depth: number; event: EventRecord }

const anchor = (e: EventRecord): number =>
  e.start ? instantOf(e.start) : e.end ? instantOf(e.end) : Number.POSITIVE_INFINITY

// 展开的文件夹：先递归子文件夹（手动 order），再追加其直属事件（起始时间升序）。
function buildRows(
  nodes: CategoryNode[], eventsByCat: Map<Id, EventRecord[]>, expanded: Set<Id>, depth = 0, out: Row[] = [],
): Row[] {
  for (const n of nodes) {
    const evs = eventsByCat.get(n.category.id) ?? []
    const hasChildren = n.children.length > 0 || evs.length > 0
    out.push({ kind: 'folder', id: n.category.id, depth, node: n, hasChildren })
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
  e.start ? formatTimePointShort(e.start, locale) : e.end ? formatTimePointShort(e.end, locale) : '—'

const indent = (depth: number) => ({ paddingLeft: 6 + depth * 14 })

export interface FolderPanelProps {
  onEdit: (id: Id) => void
}

export function FolderPanel({ onEdit }: FolderPanelProps) {
  const app = useAppStore()
  const t = useT()
  const tn = useTn()
  const locale = useLocale()
  const confirm = useConfirm()
  const toast = useToast()
  const events = useAppSelector((s) => s.events)
  const categories = useAppSelector((s) => s.categories)
  const scope = useAppSelector((s) => s.filter.scope)

  const [expanded, setExpanded] = useState<Set<Id>>(new Set()) // 默认全折叠
  const [addFor, setAddFor] = useState<Id | null | undefined>(undefined) // undefined = form closed
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
  const cancelSpring = () => {
    if (springRef.current) {
      clearTimeout(springRef.current.timer)
      springRef.current = null
    }
  }
  // 弹簧式展开：拖着事件在折叠文件夹上停留一会儿才展开，避免路过全展开。
  const armSpring = (id: Id) => {
    if (springRef.current?.id === id) return
    cancelSpring()
    springRef.current = { id, timer: setTimeout(() => { setExpanded((p) => new Set(p).add(id)); springRef.current = null }, 600) }
  }
  const endDrag = () => { setDragId(null); setDrop(null); setTailOver(false); setDragKind(null); setDropFolderId(null); cancelSpring() }

  const tree = useMemo(() => buildCategoryTree(categories), [categories])
  const counts = useMemo(() => categoryEventCounts({ events, categories }), [events, categories])
  const liveEvents = useMemo(() => events.filter((e) => !e.deleted), [events])
  const byId = useMemo(() => new Map(categories.filter((c) => !c.deleted).map((c) => [c.id, c])), [categories])
  const members = useMemo(() => memberEventIds(scope, categories, events), [scope, categories, events])
  const checkStates = useMemo(
    () => folderCheckStates(categories, events, members, new Set(scope.folderIds)),
    [categories, events, members, scope.folderIds],
  )
  const eventsByCat = useMemo(() => {
    const m = new Map<Id, EventRecord[]>()
    for (const e of liveEvents) {
      if (e.categoryId == null) continue
      const arr = m.get(e.categoryId) ?? []
      arr.push(e)
      m.set(e.categoryId, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => anchor(a) - anchor(b))
    return m
  }, [liveEvents])
  const rows = buildRows(tree, eventsByCat, expanded)

  const clearModes = { uncategorized: false, untagged: false, trash: false }
  const solo = (id: Id) => app.setFilter({ scope: soloFolder(id), ...clearModes })
  const toggleFolderScope = (id: Id) => app.setFilter({ scope: toggleFolder(scope, id, categories, events), ...clearModes })
  const toggleEventScope = (e: EventRecord) => app.setFilter({ scope: toggleEvent(scope, e, categories), ...clearModes })

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
      const self = categories.find((c) => c.id === renaming)
      if (n && self && n !== self.name) {
        if (liveFolderAt(categories, n, self.parentId, renaming)) {
          setRenameError(t('sidebar.renameDuplicate'))
          return
        }
        void app.updateCategory(renaming, { name: n })
      }
    }
    setRenaming(null)
    setRenameError('')
  }

  const del = async (id: Id, name: string) => {
    const ids = descendantCategoryIds(categories, id)
    const n = liveEvents.filter((e) => e.categoryId != null && ids.has(e.categoryId)).length
    if (n > 0) {
      const ok = await confirm({
        title: t('sidebar.deleteFolder', { name }),
        message: tn('sidebar.deleteFolderConfirm', n, { name }),
        confirmLabel: t('common.delete'),
        danger: true,
      })
      if (!ok) return
    }
    await app.deleteCategory(id)
    toast({
      message: n > 0 ? tn('toast.folderDeletedWithEvents', n, { name }) : t('toast.folderDeleted', { name }),
      action: { label: t('common.undo'), run: () => void app.undo() },
    })
  }

  const openAdd = (parent: Id | null) => {
    setAddFor((cur) => (cur === parent ? undefined : parent))
    if (parent) setExpanded((p) => new Set(p).add(parent))
  }

  const onDrop = () => {
    if (dragId && drop) {
      const { parentId, beforeId } = computeDropTarget(categories, dragId, drop.id, drop.mode)
      const drag = categories.find((c) => c.id === dragId)
      if (!(drag && liveFolderAt(categories, drag.name, parentId, dragId))) void app.moveCategory(dragId, parentId, beforeId)
    }
    endDrag()
  }
  const onTailDrop = () => {
    if (dragKind === 'event') { endDrag(); return } // 事件拖到文件夹外 = 无操作
    if (dragId) {
      const drag = categories.find((c) => c.id === dragId)
      if (!(drag && liveFolderAt(categories, drag.name, null, dragId))) void app.moveCategory(dragId, null, null)
    }
    endDrag()
  }

  const defaultParent = scope.folderIds.length === 1 && scope.includeEvents.length === 0 ? scope.folderIds[0] : null

  return (
    <section className="module">
      <div className="module-head">
        <h2>{t('sidebar.folders')}</h2>
        <button type="button" className="icon-btn icon-btn--sm" aria-label={t('sidebar.addFolder')} title={t('sidebar.addFolder')}
          aria-expanded={addFor !== undefined} onClick={() => openAdd(addFor === undefined ? defaultParent : (addFor ?? null))}>
          <Icon name="plus" size={15} />
        </button>
      </div>
      {addFor !== undefined && (
        <AddFolderForm key={addFor ?? 'top'} defaultParentId={addFor}
          onCreated={() => setAddFor(undefined)} onCancel={() => setAddFor(undefined)} />
      )}
      {rows.length === 0 && addFor === undefined && (
        <button type="button" className="module-empty" onClick={() => openAdd(null)}>
          <Icon name="folderPlus" size={15} />
          <span>{t('sidebar.noFolders')}</span>
        </button>
      )}
      <div className={dragId != null ? 'tree is-dragging' : 'tree'} role="tree" aria-label={t('sidebar.folders')} onDragEnd={endDrag}>
        {rows.map((row) => {
          if (row.kind === 'event') {
            const e = row.event
            return (
              <div key={`e-${row.id}`} className="tree-row event-row" role="treeitem" aria-level={row.depth + 1} draggable
                style={indent(row.depth)}
                onDragStart={(ev) => { ev.stopPropagation(); setDragId(e.id); setDragKind('event') }}>
                <span className="twisty-spacer" />
                <Checkbox state={members.has(e.id) ? 'checked' : 'unchecked'} label={t('common.selectEvent', { title: e.title })}
                  onClick={() => toggleEventScope(e)} />
                {/* 打开编辑器的点击区从事件名开始往右，避开旁边的小复选框 */}
                <button type="button" className="ev-main" title={e.title} onClick={() => { app.select(e.id); onEdit(e.id) }}>
                  <span className="ev-label">{e.title}</span>
                  <span className="ev-time">{eventTime(e, locale)}</span>
                </button>
              </div>
            )
          }
          const c = byId.get(row.id)!
          const isOpen = expanded.has(row.id)
          const cls = ['tree-row', 'folder-row']
          if (drop?.id === row.id) cls.push(`drop-${drop.mode}`)
          if (dragKind === 'event' && dropFolderId === row.id) cls.push('drop-into')
          if (dragId === row.id) cls.push('is-dragged')
          if (scope.folderIds.length === 1 && scope.folderIds[0] === row.id) cls.push('is-solo')
          return (
            <Fragment key={`f-${row.id}`}>
              <div className={cls.join(' ')} role="treeitem" aria-level={row.depth + 1}
                aria-expanded={row.hasChildren ? isOpen : undefined} draggable
                style={indent(row.depth)}
                onDragStart={() => { setDragId(row.id); setDragKind('folder') }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragKind === 'event') {
                    setDropFolderId(row.id)
                    if (!isOpen && row.hasChildren) armSpring(row.id)
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
                  <button type="button" className={isOpen ? 'twisty' : 'twisty is-collapsed'}
                    aria-label={t(isOpen ? 'sidebar.collapse' : 'sidebar.expand', { name: c.name })} aria-expanded={isOpen}
                    onClick={(e) => { e.stopPropagation(); toggleExpand(row.id) }}>
                    <Icon name="chevronDown" size={14} />
                  </button>
                ) : <span className="twisty-spacer" />}
                <Checkbox state={checkStates.get(row.id) ?? 'unchecked'} label={t('sidebar.selectFolder', { name: c.name })}
                  onClick={() => toggleFolderScope(row.id)} />
                <button type="button" className="color-dot" style={{ background: c.color }} data-picker-trigger
                  ref={colorFor === row.id ? colorDotRef : null}
                  aria-label={t('sidebar.setColor', { name: c.name })}
                  onClick={(e) => { e.stopPropagation(); setColorFor((cur) => (cur === row.id ? null : row.id)) }} />
                {renaming === row.id ? (
                  <input className="rename-input" aria-label={t('sidebar.rename', { name: c.name })} value={renameVal} autoFocus draggable={false}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onDragStart={(e) => e.preventDefault()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      else if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); setRenameError('') }
                    }}
                    onBlur={commitRename} />
                ) : (
                  <button type="button" className="row-label" onClick={() => solo(row.id)}
                    onDoubleClick={() => startRename(row.id, c.name)} title={c.name}>{c.name}</button>
                )}
                <span className="row-count">{counts.get(row.id) ?? 0}</span>
                <span className="row-actions">
                  <button type="button" aria-label={t('sidebar.addSubfolder', { name: c.name })} title={t('sidebar.addSubfolder', { name: c.name })}
                    onClick={(e) => { e.stopPropagation(); openAdd(row.id) }}>
                    <Icon name="folderPlus" size={14} />
                  </button>
                  <button type="button" aria-label={t('sidebar.renameFolder', { name: c.name })} title={t('common.rename')}
                    onClick={(e) => { e.stopPropagation(); startRename(row.id, c.name) }}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button type="button" className="is-danger" aria-label={t('sidebar.deleteFolder', { name: c.name })} title={t('common.delete')}
                    onClick={(e) => { e.stopPropagation(); void del(row.id, c.name) }}>
                    <Icon name="trash" size={14} />
                  </button>
                </span>
                {colorFor === row.id && (
                  <ColorPicker value={c.color} anchorRef={colorDotRef}
                    onPick={(hex) => { void app.updateCategory(row.id, { color: hex }); setColorFor(null) }}
                    onClose={() => setColorFor(null)} />
                )}
              </div>
              {renaming === row.id && renameError && (
                <div className="field-error rename-err" style={{ marginLeft: 6 + row.depth * 14 }}>{renameError}</div>
              )}
            </Fragment>
          )
        })}
        <div className={tailOver ? 'tree-tail is-over' : 'tree-tail'} aria-hidden="true"
          onDragOver={(e) => { if (dragId == null) return; e.preventDefault(); setDrop(null); setTailOver(true) }}
          onDragLeave={() => setTailOver(false)}
          onDrop={onTailDrop} />
      </div>
      {moveDialog}
    </section>
  )
}
