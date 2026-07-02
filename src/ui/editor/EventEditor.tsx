import { useState } from 'react'
import { TimeInput } from './TimeInput'
import { useAppStore, useAppState } from '../../state'
import { validateEvent } from '../../domain/model'
import { withFuzz, type TimePoint } from '../../domain/time'
import type { Id } from '../../domain/model'
import { FuzzInput, type FuzzValue } from './FuzzInput'
import { flattenCategoryTree } from '../../state'
import { Pill } from '../shell/Pill'
import { AddFolderForm } from '../shell/AddFolderForm'

export interface EventEditorProps {
  editingId: Id | null
  onClose: () => void
}

export function EventEditor({ editingId, onClose }: EventEditorProps) {
  const app = useAppStore()
  const state = useAppState()
  const existing = editingId ? state.events.find((e) => e.id === editingId) ?? null : null

  const [title, setTitle] = useState(existing?.title ?? '')
  const [start, setStart] = useState<TimePoint | null>(existing?.start ?? null)
  const [end, setEnd] = useState<TimePoint | null>(existing?.end ?? null)
  const [note, setNote] = useState(existing?.note ?? '')
  const [categoryId, setCategoryId] = useState<Id | ''>(existing?.categoryId ?? '')
  const [tagIds, setTagIds] = useState<Id[]>(existing?.tagIds ?? [])
  const [links, setLinks] = useState<Id[]>(existing?.links ?? [])
  const [startFuzz, setStartFuzz] = useState<FuzzValue | undefined>(existing?.start?.fuzz)
  const [endFuzz, setEndFuzz] = useState<FuzzValue | undefined>(existing?.end?.fuzz)
  const [errors, setErrors] = useState<string[]>([])

  const [fuzzStartOpen, setFuzzStartOpen] = useState(!!startFuzz)
  const [fuzzEndOpen, setFuzzEndOpen] = useState(!!endFuzz)
  const [linksOpen, setLinksOpen] = useState(links.length > 0)
  const [newFolderOpen, setNewFolderOpen] = useState(false)

  const liveTags = state.tags.filter((t) => !t.deleted)

  const toggleTag = (id: Id) =>
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const linkCandidates = state.events.filter((e) => !e.deleted && e.id !== editingId)
  const toggleLink = (id: Id) =>
    setLinks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const save = async () => {
    const result = validateEvent({ title, start: start ?? undefined, end: end ?? undefined })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    const fields = {
      title,
      start: start ? withFuzz(start, startFuzz) : undefined,
      end: end ? withFuzz(end, endFuzz) : undefined,
      note,
      categoryId: categoryId === '' ? null : categoryId,
      tagIds,
      links,
    }
    if (editingId) await app.updateEvent(editingId, fields)
    else await app.createEvent(fields)
    onClose()
  }

  const remove = async () => {
    if (editingId) await app.deleteEvent(editingId)
    onClose()
  }

  // A deleted event opened from the recycle bin: offer restore / permanent delete
  // instead of save / delete.
  const isDeleted = !!existing?.deleted
  const restore = async () => {
    if (editingId) await app.restoreEvents([editingId])
    onClose()
  }
  const purge = async () => {
    if (editingId && window.confirm('永久删除此事件？此操作不可撤销。')) {
      await app.purgeEvents([editingId])
      onClose()
    }
  }

  return (
    <div className="event-editor" role="dialog" aria-label={editingId ? '编辑事件' : '新建事件'}>
      {errors.length > 0 && (
        <ul className="errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="title-field">
        <input aria-label="标题" value={title} placeholder="事件标题…" onChange={(e) => setTitle(e.target.value)} />
      </div>

      <section className="ee-sec">
        <div className="sec-label">时间</div>
        <div className="timeblock">
          <div className="block-head">
            <span className="bh-title">起点</span>
          </div>
          <TimeInput label="起点" value={start} nowYear={state.nowYear} onChange={setStart} />
          <button type="button" className="disc" aria-expanded={fuzzStartOpen} onClick={() => setFuzzStartOpen((o) => !o)}>
            ± 误差范围
          </button>
          {fuzzStartOpen && <FuzzInput label="起点" value={startFuzz} onChange={setStartFuzz} />}
        </div>
        <div className="timeblock">
          <div className="block-head">
            <span className="bh-title">终点</span>
            <span className="bh-opt">· 留空表示这是一个时间点</span>
          </div>
          <TimeInput label="终点" value={end} nowYear={state.nowYear} onChange={setEnd} />
          <button type="button" className="disc" aria-expanded={fuzzEndOpen} onClick={() => setFuzzEndOpen((o) => !o)}>
            ± 误差范围
          </button>
          {fuzzEndOpen && <FuzzInput label="终点" value={endFuzz} onChange={setEndFuzz} />}
        </div>
      </section>

      <section className="ee-sec">
        <div className="sec-label">归类</div>
        <div className="cat-row">
          <select aria-label="文件夹" value={categoryId} onChange={(e) => setCategoryId(e.target.value as Id | '')}>
            <option value="">未分类</option>
            {flattenCategoryTree(state.categories).map((t) => (
              <option key={t.category.id} value={t.category.id}>
                {'　'.repeat(t.depth) + t.category.name}
              </option>
            ))}
          </select>
          <button type="button" className="ghost" onClick={() => setNewFolderOpen((o) => !o)}>
            ＋ 新建文件夹
          </button>
        </div>
        {newFolderOpen && (
          <AddFolderForm
            defaultParentId={categoryId || null}
            onCreated={(id) => {
              setCategoryId(id)
              setNewFolderOpen(false)
            }}
            onCancel={() => setNewFolderOpen(false)}
          />
        )}
        <div className="pills">
          {liveTags.map((t) => (
            <Pill key={t.id} label={t.name} active={tagIds.includes(t.id)} onToggle={() => toggleTag(t.id)} />
          ))}
        </div>
      </section>

      <section className="ee-sec">
        <div className="sec-label">更多</div>
        <label className="sr-only-label" htmlFor="ee-note">
          备注
        </label>
        <textarea
          id="ee-note"
          aria-label="备注"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="备注（支持 Markdown）…"
        />
        <button type="button" className="disc" aria-expanded={linksOpen} onClick={() => setLinksOpen((o) => !o)}>
          ＋ 关联其他事件
        </button>
        {linksOpen && (
          <div className="linklist">
            {linkCandidates.length === 0 && <p className="muted">暂无可关联的事件</p>}
            {linkCandidates.map((e) => (
              <label key={e.id} className="linkitem">
                <input type="checkbox" checked={links.includes(e.id)} onChange={() => toggleLink(e.id)} />
                {e.title}
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="actions">
        {isDeleted ? (
          <>
            <button type="button" className="primary" onClick={restore}>
              恢复
            </button>
            <button type="button" onClick={onClose}>
              取消
            </button>
            <button type="button" className="danger" onClick={purge}>
              永久删除
            </button>
          </>
        ) : (
          <>
            <button type="button" className="primary" onClick={save}>
              保存
            </button>
            <button type="button" onClick={onClose}>
              取消
            </button>
            {editingId && (
              <button type="button" className="danger" onClick={remove}>
                删除
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
