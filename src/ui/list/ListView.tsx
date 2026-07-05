import { useAppStore, useAppState, visibleEvents } from '../../state'
import type { Sort } from '../../state'
import { formatTimeRange } from './timeText'
import { BatchBar } from './BatchBar'
import { markdownToText } from '../features/markdown/text'
import type { Id } from '../../domain/model'
import { Checkbox } from '../shell/Checkbox'

export interface ListViewProps {
  onEdit: (id: Id) => void
}

const COLUMNS: { key: Sort['key']; label: string; cell: 'mono' | '' }[] = [
  { key: 'title', label: '标题', cell: '' },
  { key: 'start', label: '时间', cell: 'mono' },
  { key: 'category', label: '文件夹', cell: '' },
  { key: 'tags', label: '标签', cell: '' },
  { key: 'note', label: '备注', cell: 'mono' },
]

export function ListView({ onEdit }: ListViewProps) {
  const app = useAppStore()
  const state = useAppState()
  const rows = visibleEvents(state)
  const trash = !!state.filter.trash
  const checked = new Set(state.checkedIds)
  const allChecked = rows.length > 0 && rows.every((e) => checked.has(e.id))
  const someChecked = rows.some((e) => checked.has(e.id))
  const catName = (id: Id | null) => state.categories.find((c) => c.id === id)?.name ?? '—'
  const catColor = (id: Id | null) => state.categories.find((c) => c.id === id && !c.deleted)?.color ?? 'var(--faint)'
  const tagNames = (ids: Id[]) =>
    ids.map((id) => state.tags.find((t) => t.id === id)?.name).filter(Boolean).join(' ') || '—'

  const clickHeader = (key: Sort['key']) => {
    const cur = state.sort
    app.setSort(cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const toggleAll = () => {
    const visible = new Set(rows.map((e) => e.id))
    if (allChecked) {
      app.setChecked(state.checkedIds.filter((id) => !visible.has(id)))
    } else {
      app.setChecked([...new Set([...state.checkedIds, ...rows.map((e) => e.id)])])
    }
  }

  // The table scrolls inside .list-scroll while .batch-bar stays a direct child
  // of the non-scrolling .list-pane, so the floating bar doesn't scroll with the
  // rows (see the .list-pane/.list-scroll rules in chrome.css).
  return (
    <div className="list-pane">
      <BatchBar trash={trash} />
      <div className="list-scroll">
        <table className="list-view">
          <thead>
            <tr>
              <th className="col-check">
                <Checkbox
                  state={allChecked ? 'checked' : someChecked ? 'indeterminate' : 'unchecked'}
                  label="全选"
                  onClick={toggleAll}
                />
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key}>
                  <button type="button" onClick={() => clickHeader(c.key)}>
                    {c.label}
                    {state.sort.key === c.key && (
                      <span aria-hidden>{state.sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  {trash ? '回收站为空' : '暂无事件'}
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr
                key={e.id}
                className={checked.has(e.id) ? 'checked' : undefined}
                onClick={() => {
                  app.select(e.id)
                  onEdit(e.id)
                }}
              >
                {/* Editor opens only from the title column rightward: the
                    checkbox cell swallows its clicks so a near-miss around the
                    small box doesn't bubble to the row's open-editor handler. */}
                <td className="col-check" onClick={(ev) => ev.stopPropagation()}>
                  <Checkbox
                    state={checked.has(e.id) ? 'checked' : 'unchecked'}
                    label={`选择「${e.title}」`}
                    onClick={() => app.toggleChecked(e.id)}
                  />
                </td>
                {/* Open the editor from a dedicated title button (like the
                    sidebar's .ev-main), not the whole cell: the cell padding
                    stays a safe buffer to the right of the checkbox column. */}
                <td className="col-title" onClick={(ev) => ev.stopPropagation()}>
                  <button type="button" className="cell-title" title={e.title}
                    onClick={() => { app.select(e.id); onEdit(e.id) }}>
                    <span className="cell-dot" style={{ background: catColor(e.categoryId) }} aria-hidden="true" />
                    {e.title}
                  </button>
                </td>
                <td className="mono">{formatTimeRange(e.start, e.end)}</td>
                <td>{catName(e.categoryId)}</td>
                <td>{tagNames(e.tagIds)}</td>
                <td className="mono col-note">{markdownToText(e.note).slice(0, 60)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
