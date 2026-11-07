import { memo, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useAppStore, useAppSelector, useVisibleEvents, shallowEqual } from '../../state'
import type { Sort } from '../../state'
import type { Category, EventRecord, Id } from '../../domain/model'
import { formatTimeRange } from './timeText'
import { BatchBar } from './BatchBar'
import { markdownToText } from '../markdown/text'
import { Checkbox } from '../components/Checkbox'
import { Icon } from '../components/Icon'
import { useToast } from '../components/useToast'
import { EmptyState } from '../app/EmptyState'
import { useEmptyKind } from '../app/useEmptyKind'
import { highlight } from './highlight'
import { useKeys } from '../app/useShortcuts'
import { useT, useTn, useLocale } from '../../i18n/useT'
import type { MessageKey } from '../../i18n/catalog'
import type { Locale } from '../../domain/locale'

export interface ListViewProps {
  onEdit: (id: Id) => void
  onNew?: () => void
}

const COLUMNS: { key: Sort['key']; label: MessageKey; cls: string }[] = [
  { key: 'title', label: 'list.col.title', cls: 'col-title' },
  { key: 'start', label: 'list.col.time', cls: 'col-time' },
  { key: 'category', label: 'list.col.category', cls: 'col-folder' },
  { key: 'tags', label: 'list.col.tags', cls: 'col-tags' },
  { key: 'note', label: 'list.col.note', cls: 'col-note' },
]

// Past this many rows only the ones on screen (plus a margin) are rendered.
// Rows are single-line by design, so every row has the same height and the
// window is plain arithmetic on the scroll offset.
const VIRTUAL_MIN = 120
const OVERSCAN = 12

function useRowWindow(count: number, scrollRef: RefObject<HTMLDivElement | null>) {
  const enabled = count > VIRTUAL_MIN
  const [win, setWin] = useState({ start: 0, end: count, rowH: 41 })
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !enabled) return
    const measure = () => {
      if (el.clientHeight === 0) return // not laid out (jsdom, hidden): render everything
      const row = el.querySelector<HTMLElement>('tbody tr.row')
      const rowH = row?.getBoundingClientRect().height || 41
      const head = el.querySelector<HTMLElement>('thead')?.offsetHeight ?? 0
      const top = Math.max(0, el.scrollTop - head)
      const start = Math.max(0, Math.floor(top / rowH) - OVERSCAN)
      const end = Math.min(count, Math.ceil((top + el.clientHeight) / rowH) + OVERSCAN)
      setWin((w) => (w.start === start && w.end === end && w.rowH === rowH ? w : { start, end, rowH }))
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro?.disconnect()
    }
  }, [count, enabled, scrollRef])
  if (!enabled) return { start: 0, end: count, rowH: 41 }
  return { ...win, end: Math.min(win.end, count) }
}

interface RowProps {
  e: EventRecord
  checked: boolean
  folder: Category | undefined
  tagText: string
  query: string
  locale: Locale
  trash: boolean
  selectLabel: string
  locateLabel: string
  restoreLabel: string
  onOpen: (id: Id) => void
  onToggle: (id: Id) => void
  onLocate: (id: Id) => void
  onRestore: (id: Id) => void
}

const ListRow = memo(function ListRow({ e, checked, folder, tagText, query, locale, trash, selectLabel, locateLabel, restoreLabel, onOpen, onToggle, onLocate, onRestore }: RowProps) {
  const note = markdownToText(e.note)
  return (
    <tr className={checked ? 'row is-checked' : 'row'} onClick={() => onOpen(e.id)}>
      {/* The checkbox cell swallows its clicks so a near-miss around the small
          box doesn't bubble to the row's open-editor handler. */}
      <td className="col-check" onClick={(ev) => ev.stopPropagation()}>
        <Checkbox state={checked ? 'checked' : 'unchecked'} label={selectLabel} onClick={() => onToggle(e.id)} />
      </td>
      <td className="col-title" onClick={(ev) => ev.stopPropagation()}>
        <button type="button" className="cell-title" title={e.title} onClick={() => onOpen(e.id)}>
          <span className="cell-dot" style={{ background: folder && !folder.deleted ? folder.color : undefined }} aria-hidden="true" />
          <span className="cell-title-text">{highlight(e.title, query)}</span>
        </button>
      </td>
      <td className="col-time mono">{formatTimeRange(e.start, e.end, locale)}</td>
      <td className="col-folder">{folder && !folder.deleted ? folder.name : <span className="faint">—</span>}</td>
      <td className="col-tags">{tagText || <span className="faint">—</span>}</td>
      <td className="col-note">{note ? highlight(note.slice(0, 80), query) : ''}</td>
      <td className="col-actions" onClick={(ev) => ev.stopPropagation()}>
        {trash ? (
          <button type="button" className="icon-btn icon-btn--sm" aria-label={restoreLabel} title={restoreLabel} onClick={() => onRestore(e.id)}>
            <Icon name="restore" size={15} />
          </button>
        ) : (
          <button type="button" className="icon-btn icon-btn--sm" aria-label={locateLabel} title={locateLabel} onClick={() => onLocate(e.id)}>
            <Icon name="locate" size={15} />
          </button>
        )}
      </td>
    </tr>
  )
})

export function ListView({ onEdit, onNew }: ListViewProps) {
  const app = useAppStore()
  const t = useT()
  const tn = useTn()
  const locale = useLocale()
  const toast = useToast()
  const rows = useVisibleEvents()
  const emptyKind = useEmptyKind()
  const { sort, checkedIds, trash, query, categories, tags } = useAppSelector(
    (s) => ({
      sort: s.sort,
      checkedIds: s.checkedIds,
      trash: !!s.filter.trash,
      query: s.filter.query,
      categories: s.categories,
      tags: s.tags,
    }),
    shallowEqual,
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const win = useRowWindow(rows.length, scrollRef)
  const checked = useMemo(() => new Set(checkedIds), [checkedIds])
  const allChecked = rows.length > 0 && rows.every((e) => checked.has(e.id))
  const someChecked = !allChecked && rows.some((e) => checked.has(e.id))
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const tagName = useMemo(() => new Map(tags.filter((x) => !x.deleted).map((x) => [x.id, x.name])), [tags])

  const clickHeader = (key: Sort['key']) =>
    app.setSort(sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })

  const toggleAll = () => {
    const visible = new Set(rows.map((e) => e.id))
    if (allChecked) app.setChecked(checkedIds.filter((id) => !visible.has(id)))
    else app.setChecked([...new Set([...checkedIds, ...rows.map((e) => e.id)])])
  }

  // stable across renders so the memoized rows do not all re-render
  const handlers = useMemo(
    () => ({
      open: (id: Id) => {
        app.select(id)
        onEdit(id)
      },
      toggle: (id: Id) => app.toggleChecked(id),
      locate: (id: Id) => app.revealEvent(id),
      restore: async (id: Id) => {
        const { conflicts } = await app.restoreEvents([id])
        if (conflicts.length === 0) toast({ message: tn('toast.restored', 1), action: { label: t('common.undo'), run: () => void app.undo() } })
        else onEdit(id) // the editor walks the user through the conflict
      },
    }),
    [app, onEdit, toast, t, tn],
  )

  useKeys({
    'mod+a': () => app.setChecked(rows.map((e) => e.id)),
    Escape: () => checkedIds.length > 0 && app.setChecked([]),
    Delete: () => {
      if (checkedIds.length === 0 || trash) return
      const n = checkedIds.length
      void app.deleteEvents(checkedIds).then(() =>
        toast({ message: tn('toast.deleted', n), action: { label: t('common.undo'), run: () => void app.undo() } }),
      )
    },
  })

  if (rows.length === 0) {
    return (
      <div className="list-pane">
        <EmptyState kind={emptyKind} onNew={onNew ?? (() => {})} />
      </div>
    )
  }

  const visible = rows.slice(win.start, win.end)
  const locateLabel = t('list.locate')
  const restoreLabel = t('common.restore')

  // The table scrolls inside .list-scroll while .batch-bar stays a direct child
  // of the non-scrolling .list-pane, so the floating bar doesn't scroll away.
  return (
    <div className="list-pane">
      <BatchBar trash={trash} />
      <div className="list-scroll" ref={scrollRef}>
        <table className="list-view">
          <thead>
            <tr>
              <th className="col-check">
                <Checkbox
                  state={allChecked ? 'checked' : someChecked ? 'indeterminate' : 'unchecked'}
                  label={t('list.selectAll')}
                  onClick={toggleAll}
                />
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={c.cls} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <button type="button" onClick={() => clickHeader(c.key)}>
                    {t(c.label)}
                    {sort.key === c.key && <Icon name="chevronDown" size={12} className={sort.dir === 'asc' ? 'sort-caret is-asc' : 'sort-caret'} />}
                  </button>
                </th>
              ))}
              <th className="col-actions" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {win.start > 0 && <tr className="spacer" aria-hidden="true" style={{ height: win.start * win.rowH }} />}
            {visible.map((e) => (
              <ListRow
                key={e.id}
                e={e}
                checked={checked.has(e.id)}
                folder={e.categoryId != null ? catById.get(e.categoryId) : undefined}
                tagText={e.tagIds.map((id) => tagName.get(id)).filter(Boolean).join(' · ')}
                query={query}
                locale={locale}
                trash={trash}
                selectLabel={t('common.selectEvent', { title: e.title })}
                locateLabel={locateLabel}
                restoreLabel={restoreLabel}
                onOpen={handlers.open}
                onToggle={handlers.toggle}
                onLocate={handlers.locate}
                onRestore={handlers.restore}
              />
            ))}
            {win.end < rows.length && <tr className="spacer" aria-hidden="true" style={{ height: (rows.length - win.end) * win.rowH }} />}
          </tbody>
        </table>
      </div>
    </div>
  )
}
