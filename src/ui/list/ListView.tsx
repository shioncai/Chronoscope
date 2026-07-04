import { useAppStore, useAppState, visibleEvents } from '../../state'
import type { Sort } from '../../state'
import { formatTimeRange } from './timeText'
import { BatchBar } from './BatchBar'
import { markdownToText } from '../features/markdown/text'
import type { Id } from '../../domain/model'

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

  return (
    <div className="list-pane">
      <BatchBar trash={trash} />
      <table className="list-view">
        <thead>
          <tr>
            <th className="col-check">
              <input
                type="checkbox"
                aria-label="全选"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked && !allChecked
                }}
                onChange={toggleAll}
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
              <td className="col-check">
                <input
                  type="checkbox"
                  aria-label={`选择「${e.title}」`}
                  checked={checked.has(e.id)}
                  onChange={() => app.toggleChecked(e.id)}
                  onClick={(ev) => ev.stopPropagation()}
                />
              </td>
              <td>
                <span className="cell-dot" style={{ background: catColor(e.categoryId) }} aria-hidden="true" />
                {e.title}
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
  )
}
