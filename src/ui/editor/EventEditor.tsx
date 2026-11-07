import { useMemo, useState } from 'react'
import { TimeInput } from './TimeInput'
import { FuzzInput, type FuzzValue } from './FuzzInput'
import { LinkPicker } from './LinkPicker'
import { useAppStore, useAppSelector, liveEventAt, flattenCategoryTree, freeTitle, shallowEqual } from '../../state'
import { validateEvent, type Id } from '../../domain/model'
import { withFuzz, instantOf, formatDuration, type TimePoint } from '../../domain/time'
import { Pill } from '../components/Pill'
import { Icon } from '../components/Icon'
import { ModalOverlay } from '../components/ModalOverlay'
import { useConfirm } from '../components/useConfirm'
import { useToast } from '../components/useToast'
import { Markdown } from '../markdown/Markdown'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { AddFolderForm } from '../sidebar/AddFolderForm'
import { AddTagForm } from '../sidebar/AddTagForm'
import { EventConflictDialog, type EventConflictItem } from '../dialogs/EventConflictDialog'
import { useT, useTn, useLocale } from '../../i18n/useT'
import type { MessageKey } from '../../i18n/catalog'

interface Snap {
  title: string
  start?: TimePoint
  end?: TimePoint
  note: string
  categoryId: Id | null
  tagIds: Id[]
  links: Id[]
}
const snapshot = (f: Snap) => JSON.stringify([f.title, f.start ?? null, f.end ?? null, f.note, f.categoryId, f.tagIds, f.links])

export interface EventEditorProps {
  editingId: Id | null
  onClose: () => void
  /** Open another event in the editor (the copy, after a duplicate). */
  onSwitch?: (id: Id) => void
}

/**
 * Create or edit one event, in a modal. A new event starts inside whatever
 * the filter is showing — the one folder that is scoped, the tags being
 * filtered on — so it does not vanish from the view the moment it is saved.
 */
export function EventEditor({ editingId, onClose, onSwitch }: EventEditorProps) {
  const app = useAppStore()
  const t = useT()
  const tn = useTn()
  const locale = useLocale()
  const confirm = useConfirm()
  const toast = useToast()
  const { events, categories, tags, filter, view } = useAppSelector(
    (s) => ({ events: s.events, categories: s.categories, tags: s.tags, filter: s.filter, view: s.view }),
    shallowEqual,
  )
  const existing = editingId ? events.find((e) => e.id === editingId) ?? null : null

  const [initial] = useState(() => {
      if (existing) {
        return {
          title: existing.title,
          start: existing.start ?? null,
          end: existing.end ?? null,
          note: existing.note,
          categoryId: existing.categoryId ?? '',
          tagIds: existing.tagIds,
          links: existing.links,
        }
      }
      const sc = filter.scope
      const folder = !filter.uncategorized && sc.folderIds.length === 1 && sc.includeEvents.length === 0 ? sc.folderIds[0] : ''
      const presetTags = !filter.untagged && (filter.tagMode === 'and' || filter.tagIds.length === 1) ? filter.tagIds : []
      return { title: '', start: null, end: null, note: '', categoryId: folder, tagIds: presetTags, links: [] as Id[] }
  })

  const [title, setTitle] = useState(initial.title)
  const [start, setStart] = useState<TimePoint | null>(initial.start ?? null)
  const [end, setEnd] = useState<TimePoint | null>(initial.end ?? null)
  const [note, setNote] = useState(initial.note)
  const [categoryId, setCategoryId] = useState<Id | ''>(initial.categoryId)
  const [tagIds, setTagIds] = useState<Id[]>(initial.tagIds)
  const [links, setLinks] = useState<Id[]>(initial.links)
  const [startFuzz, setStartFuzz] = useState<FuzzValue | undefined>(existing?.start?.fuzz)
  const [endFuzz, setEndFuzz] = useState<FuzzValue | undefined>(existing?.end?.fuzz)
  const [errors, setErrors] = useState<MessageKey[]>([])

  const [fuzzStartOpen, setFuzzStartOpen] = useState(!!startFuzz)
  const [fuzzEndOpen, setFuzzEndOpen] = useState(!!endFuzz)
  const [linksOpen, setLinksOpen] = useState(initial.links.length > 0)
  const [preview, setPreview] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newTagOpen, setNewTagOpen] = useState(false)
  const [restoreConflict, setRestoreConflict] = useState<EventConflictItem[] | null>(null)

  const liveTags = useMemo(() => tags.filter((x) => !x.deleted), [tags])
  const folders = useMemo(() => flattenCategoryTree(categories), [categories])
  const isDeleted = !!existing?.deleted

  const fields = () => ({
    title: title.trim(),
    start: start ? withFuzz(start, startFuzz) : undefined,
    end: end ? withFuzz(end, endFuzz) : undefined,
    note,
    categoryId: categoryId === '' ? null : categoryId,
    tagIds,
    links,
  })
  const [initialSnap] = useState(() =>
    snapshot({
      title: initial.title.trim(),
      start: initial.start ?? undefined,
      end: initial.end ?? undefined,
      note: initial.note,
      categoryId: initial.categoryId === '' ? null : initial.categoryId,
      tagIds: initial.tagIds,
      links: initial.links,
    }),
  )
  const dirty = !isDeleted && snapshot(fields()) !== initialSnap

  const requestClose = async () => {
    if (dirty) {
      const ok = await confirm({
        title: t('editor.discardTitle'),
        message: t('editor.discardMessage'),
        confirmLabel: t('editor.discard'),
        cancelLabel: t('editor.keepEditing'),
        danger: true,
      })
      if (!ok) return
    }
    onClose()
  }
  const trapRef = useFocusTrap<HTMLDivElement>(true, () => void requestClose())

  const duration = start && end ? instantOf(end) - instantOf(start) : null

  const save = async () => {
    const f = fields()
    const result = validateEvent(f)
    if (!result.ok) {
      setErrors(result.errors.map((c) => `editor.error.${c}` as MessageKey))
      return
    }
    if (liveEventAt(events, f.title, f.categoryId, editingId ?? undefined)) {
      setErrors(['editor.error.duplicateTitle'])
      return
    }
    if (editingId) {
      await app.updateEvent(editingId, f)
    } else {
      const id = await app.createEvent(f)
      if (view === 'timeline') app.revealEvent(id)
    }
    onClose()
  }

  const undoToast = (message: string) => toast({ message, action: { label: t('common.undo'), run: () => void app.undo() } })

  const remove = async () => {
    if (!editingId) return
    await app.deleteEvent(editingId)
    undoToast(tn('toast.deleted', 1))
    onClose()
  }

  const duplicate = async () => {
    if (!existing) return
    if (dirty) await app.updateEvent(existing.id, fields())
    const copy = await app.duplicateEvent(existing.id, freeTitle(app.store.getState().events, title, categoryId || null))
    undoToast(t('toast.duplicated'))
    onSwitch?.(copy)
  }

  const restore = async () => {
    if (!editingId) return
    const { conflicts } = await app.restoreEvents([editingId])
    if (conflicts.length) {
      const all = app.store.getState().events
      setRestoreConflict(conflicts.map((c) => ({
        incoming: all.find((e) => e.id === c.eventId)!,
        existing: all.find((e) => e.id === c.existingId)!,
      })))
      return
    }
    undoToast(tn('toast.restored', 1))
    onClose()
  }
  const purge = async () => {
    if (!editingId) return
    const ok = await confirm({ title: t('common.purge'), message: t('editor.purgeConfirm'), confirmLabel: t('common.purge'), danger: true })
    if (!ok) return
    await app.purgeEvents([editingId])
    undoToast(tn('toast.purged', 1))
    onClose()
  }

  const toggleTag = (id: Id) => setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const heading = editingId ? t('editor.editEvent') : t('editor.newEvent')

  return (
    <ModalOverlay onClose={() => void requestClose()}>
      <div className="dialog editor" ref={trapRef} role="dialog" aria-modal="true" aria-label={heading}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isDeleted) {
            e.preventDefault()
            void save()
          }
        }}>
        <header className="editor-head">
          <h2>{heading}</h2>
          {isDeleted && <span className="badge">{t('editor.inTrash')}</span>}
          <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={() => void requestClose()}>
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="editor-body">
          {errors.length > 0 && (
            <ul className="form-errors" role="alert">
              {errors.map((k) => <li key={k}>{t(k)}</li>)}
            </ul>
          )}

          <input
            className="editor-title"
            aria-label={t('editor.titleAria')}
            value={title}
            placeholder={t('editor.titlePlaceholder')}
            data-autofocus={editingId ? undefined : ''}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && !isDeleted) {
                e.preventDefault()
                void save()
              }
            }}
          />

          <section className="editor-sec">
            <h3 className="sec-label">{t('editor.sectionTime')}</h3>
            <div className="time-block">
              <div className="block-head">
                <span className="block-title">{t('editor.start')}</span>
              </div>
              <TimeInput label={t('editor.start')} value={start} onChange={setStart} />
              <button type="button" className="disclosure" aria-expanded={fuzzStartOpen} onClick={() => setFuzzStartOpen((o) => !o)}>
                <Icon name="chevronRight" size={13} className="disclosure-caret" />
                {t('editor.fuzzToggle')}
              </button>
              {fuzzStartOpen && <FuzzInput label={t('editor.start')} value={startFuzz} onChange={setStartFuzz} />}
            </div>
            <div className="time-block">
              <div className="block-head">
                <span className="block-title">{t('editor.end')}</span>
                <span className="block-hint">{t('editor.endHint')}</span>
              </div>
              <TimeInput label={t('editor.end')} value={end} onChange={setEnd} />
              <button type="button" className="disclosure" aria-expanded={fuzzEndOpen} onClick={() => setFuzzEndOpen((o) => !o)}>
                <Icon name="chevronRight" size={13} className="disclosure-caret" />
                {t('editor.fuzzToggle')}
              </button>
              {fuzzEndOpen && <FuzzInput label={t('editor.end')} value={endFuzz} onChange={setEndFuzz} />}
            </div>
            {duration !== null && duration >= 0 && (
              <p className="editor-duration">{t('editor.duration', { d: formatDuration(duration, locale) })}</p>
            )}
          </section>

          <section className="editor-sec">
            <h3 className="sec-label">{t('editor.sectionCategory')}</h3>
            <div className="field-row">
              <select className="field--grow" aria-label={t('editor.folderAria')} value={categoryId} onChange={(e) => setCategoryId(e.target.value as Id | '')}>
                <option value="">{t('common.uncategorized')}</option>
                {folders.map((ct) => (
                  <option key={ct.category.id} value={ct.category.id}>{'　'.repeat(ct.depth) + ct.category.name}</option>
                ))}
              </select>
              <button type="button" className="btn" aria-expanded={newFolderOpen} onClick={() => setNewFolderOpen((o) => !o)}>
                <Icon name="folderPlus" size={15} />
                <span>{t('editor.newFolder')}</span>
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
              <button type="button" className="pill-add" aria-expanded={newTagOpen} onClick={() => setNewTagOpen((o) => !o)}>
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

          <section className="editor-sec">
            <div className="sec-head">
              <h3 className="sec-label">{t('editor.note')}</h3>
              <div className="segmented segmented--sm" role="group" aria-label={t('editor.note')}>
                <button type="button" className={preview ? '' : 'is-active'} aria-pressed={!preview} onClick={() => setPreview(false)}>{t('editor.write')}</button>
                <button type="button" className={preview ? 'is-active' : ''} aria-pressed={preview} onClick={() => setPreview(true)}>{t('editor.preview')}</button>
              </div>
            </div>
            {preview ? (
              <div className="note-preview">{note.trim() ? <Markdown source={note} /> : <span className="faint">{t('editor.previewEmpty')}</span>}</div>
            ) : (
              <textarea
                aria-label={t('editor.note')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder={t('editor.notePlaceholder')}
              />
            )}
            <button type="button" className="disclosure" aria-expanded={linksOpen} onClick={() => setLinksOpen((o) => !o)}>
              <Icon name="chevronRight" size={13} className="disclosure-caret" />
              {t('editor.linkToggle')}
              {links.length > 0 && <span className="badge">{links.length}</span>}
            </button>
            {linksOpen && <LinkPicker events={events} selfId={editingId} value={links} onChange={setLinks} />}
          </section>
        </div>

        <footer className="editor-foot">
          {isDeleted ? (
            <>
              <button type="button" className="btn btn-danger-quiet" onClick={() => void purge()}>
                <Icon name="trash" size={15} />
                <span>{t('common.purge')}</span>
              </button>
              <span className="foot-spacer" />
              <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={() => void restore()}>
                <Icon name="restore" size={15} />
                <span>{t('common.restore')}</span>
              </button>
            </>
          ) : (
            <>
              {editingId && (
                <>
                  <button type="button" className="btn btn-danger-quiet" onClick={() => void remove()}>
                    <Icon name="trash" size={15} />
                    <span>{t('common.delete')}</span>
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => void duplicate()} title={t('editor.duplicateHint')}>
                    <Icon name="copy" size={15} />
                    <span>{t('editor.duplicate')}</span>
                  </button>
                </>
              )}
              <span className="foot-spacer" />
              <button type="button" className="btn" onClick={() => void requestClose()}>{t('common.cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={() => void save()} title={t('editor.saveHint')}>
                {t('common.save')}
              </button>
            </>
          )}
        </footer>
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
    </ModalOverlay>
  )
}
