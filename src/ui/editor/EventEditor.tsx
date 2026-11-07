import { useState } from 'react'
import { TimeInput } from './TimeInput'
import { useAppStore, useAppState, liveEventAt } from '../../state'
import { validateEvent } from '../../domain/model'
import { withFuzz, type TimePoint } from '../../domain/time'
import type { Id } from '../../domain/model'
import { FuzzInput, type FuzzValue } from './FuzzInput'
import { flattenCategoryTree } from '../../state'
import { Pill } from '../components/Pill'
import { AddFolderForm } from '../sidebar/AddFolderForm'
import { AddTagForm } from '../sidebar/AddTagForm'
import { EventConflictDialog, type EventConflictItem } from '../dialogs/EventConflictDialog'
import { useT } from '../../i18n/useT'
import type { MessageKey } from '../../i18n/catalog'

export interface EventEditorProps {
  editingId: Id | null
  onClose: () => void
}

export function EventEditor({ editingId, onClose }: EventEditorProps) {
  const app = useAppStore()
  const state = useAppState()
  const t = useT()
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
  const [errors, setErrors] = useState<MessageKey[]>([])

  const [fuzzStartOpen, setFuzzStartOpen] = useState(!!startFuzz)
  const [fuzzEndOpen, setFuzzEndOpen] = useState(!!endFuzz)
  const [linksOpen, setLinksOpen] = useState(links.length > 0)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newTagOpen, setNewTagOpen] = useState(false)
  const [restoreConflict, setRestoreConflict] = useState<EventConflictItem[] | null>(null)

  const liveTags = state.tags.filter((tg) => !tg.deleted)

  const toggleTag = (id: Id) =>
    setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const linkCandidates = state.events.filter((e) => !e.deleted && e.id !== editingId)
  const toggleLink = (id: Id) =>
    setLinks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const save = async () => {
    const result = validateEvent({ title, start: start ?? undefined, end: end ?? undefined })
    if (!result.ok) {
      setErrors(result.errors.map((c) => `editor.error.${c}` as MessageKey))
      return
    }
    const targetCat = categoryId === '' ? null : categoryId
    if (liveEventAt(state.events, title, targetCat, editingId ?? undefined)) {
      setErrors(['editor.error.duplicateTitle'])
      return
    }
    const fields = {
      title,
      start: start ? withFuzz(start, startFuzz) : undefined,
      end: end ? withFuzz(end, endFuzz) : undefined,
      note,
      categoryId: targetCat,
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
    if (!editingId) return
    const { conflicts } = await app.restoreEvents([editingId])
    if (conflicts.length) {
      setRestoreConflict(
        conflicts.map((c) => ({
          incoming: state.events.find((e) => e.id === c.eventId)!,
          existing: state.events.find((e) => e.id === c.existingId)!,
        })),
      )
      return
    }
    onClose()
  }
  const purge = async () => {
    if (editingId && window.confirm(t('editor.purgeConfirm'))) {
      await app.purgeEvents([editingId])
      onClose()
    }
  }

  return (
    <div className="event-editor" role="dialog" aria-label={editingId ? t('editor.editEvent') : t('editor.newEvent')}>
      {errors.length > 0 && (
        <ul className="errors">
          {errors.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      )}

      <div className="title-field">
        <input
          aria-label={t('editor.titleAria')}
          value={title}
          placeholder={t('editor.titlePlaceholder')}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <section className="ee-sec">
        <div className="sec-label">{t('editor.sectionTime')}</div>
        <div className="timeblock">
          <div className="block-head">
            <span className="bh-title">{t('editor.start')}</span>
          </div>
          <TimeInput label={t('editor.start')} value={start} onChange={setStart} />
          <button type="button" className="disc" aria-expanded={fuzzStartOpen} onClick={() => setFuzzStartOpen((o) => !o)}>
            {t('editor.fuzzToggle')}
          </button>
          {fuzzStartOpen && <FuzzInput label={t('editor.start')} value={startFuzz} onChange={setStartFuzz} />}
        </div>
        <div className="timeblock">
          <div className="block-head">
            <span className="bh-title">{t('editor.end')}</span>
            <span className="bh-opt">{t('editor.endHint')}</span>
          </div>
          <TimeInput label={t('editor.end')} value={end} onChange={setEnd} />
          <button type="button" className="disc" aria-expanded={fuzzEndOpen} onClick={() => setFuzzEndOpen((o) => !o)}>
            {t('editor.fuzzToggle')}
          </button>
          {fuzzEndOpen && <FuzzInput label={t('editor.end')} value={endFuzz} onChange={setEndFuzz} />}
        </div>
      </section>

      <section className="ee-sec">
        <div className="sec-label">{t('editor.sectionCategory')}</div>
        <div className="cat-row">
          <select aria-label={t('editor.folderAria')} value={categoryId} onChange={(e) => setCategoryId(e.target.value as Id | '')}>
            <option value="">{t('common.uncategorized')}</option>
            {flattenCategoryTree(state.categories).map((ct) => (
              <option key={ct.category.id} value={ct.category.id}>
                {'　'.repeat(ct.depth) + ct.category.name}
              </option>
            ))}
          </select>
          <button type="button" className="ghost" onClick={() => setNewFolderOpen((o) => !o)}>
            {t('editor.newFolder')}
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
          {liveTags.map((tg) => (
            <Pill key={tg.id} label={tg.name} active={tagIds.includes(tg.id)} onToggle={() => toggleTag(tg.id)} />
          ))}
          <button type="button" className="pill add" aria-expanded={newTagOpen} onClick={() => setNewTagOpen((o) => !o)}>
            {t('editor.newTag')}
          </button>
        </div>
        {newTagOpen && (
          <AddTagForm
            onCreated={(id) => {
              setTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
              setNewTagOpen(false)
            }}
            onCancel={() => setNewTagOpen(false)}
          />
        )}
      </section>

      <section className="ee-sec">
        <div className="sec-label">{t('editor.sectionMore')}</div>
        <label className="sr-only-label" htmlFor="ee-note">
          {t('editor.note')}
        </label>
        <textarea
          id="ee-note"
          aria-label={t('editor.note')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder={t('editor.notePlaceholder')}
        />
        <button type="button" className="disc" aria-expanded={linksOpen} onClick={() => setLinksOpen((o) => !o)}>
          {t('editor.linkToggle')}
        </button>
        {linksOpen && (
          <div className="linklist">
            {linkCandidates.length === 0 && <p className="muted">{t('editor.noLinkCandidates')}</p>}
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
              {t('common.restore')}
            </button>
            <button type="button" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className="danger" onClick={purge}>
              {t('common.purge')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="primary" onClick={save}>
              {t('common.save')}
            </button>
            <button type="button" onClick={onClose}>
              {t('common.cancel')}
            </button>
            {editingId && (
              <button type="button" className="danger" onClick={remove}>
                {t('common.delete')}
              </button>
            )}
          </>
        )}
      </div>
      {restoreConflict && (
        <EventConflictDialog
          title={t('conflict.restoreTitle')}
          conflicts={restoreConflict}
          onResolve={(choices) => {
            void (async () => {
              await app.restoreEvents(Object.keys(choices), choices)
              setRestoreConflict(null)
              onClose()
            })()
          }}
          onCancel={() => setRestoreConflict(null)}
        />
      )}
    </div>
  )
}
