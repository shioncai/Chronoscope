import { useState, type ReactNode } from 'react'
import { useAppStore, useAppSelector, moveConflicts, dedupeTargetMovers } from '../../state'
import { EventConflictDialog, type EventConflictItem } from '../dialogs/EventConflictDialog'
import { useToast } from '../components/useToast'
import { useT, useTn } from '../../i18n/useT'
import type { Id } from '../../domain/model'

// Shared “move events into a folder, resolving same-title (title, folder)
// collisions via the conflict dialog” flow. Used by the list batch bar and the
// sidebar drag-to-reparent. A single-event move is just ids.length === 1.
export function useEventMove(): { move: (ids: Id[], targetId: Id | null) => void; dialog: ReactNode } {
  const app = useAppStore()
  const events = useAppSelector((s) => s.events)
  const t = useT()
  const tn = useTn()
  const toast = useToast()
  const done = (n: number) => n > 0 && toast({ message: tn('toast.moved', n), action: { label: t('common.undo'), run: () => void app.undo() } })
  const [ctx, setCtx] = useState<{ target: Id | null; ids: Id[]; items: EventConflictItem[] } | null>(null)

  const move = (ids: Id[], target: Id | null) => {
    const conflicts = moveConflicts(events, ids, target)
    if (conflicts.length === 0) {
      const movers = dedupeTargetMovers(events, ids, target)
      void app.setEventsCategory(movers, target).then(() => done(movers.length))
      return
    }
    setCtx({
      target,
      ids,
      items: conflicts.map((c) => ({
        incoming: events.find((e) => e.id === c.movingId)!,
        existing: events.find((e) => e.id === c.existingId)!,
      })),
    })
  }

  const resolve = async (choices: Record<Id, 'overwrite' | 'skip'>) => {
    const c = ctx!
    setCtx(null)
    const conflictIds = new Set(c.items.map((i) => i.incoming.id))
    const superseded = c.items.filter((i) => choices[i.incoming.id] === 'overwrite').map((i) => i.existing.id)
    const toMove = c.ids.filter((id) => !conflictIds.has(id) || choices[id] !== 'skip')
    if (superseded.length) await app.purgeEvents(superseded)
    const movers = dedupeTargetMovers(events, toMove, c.target, new Set(superseded))
    await app.setEventsCategory(movers, c.target)
    done(movers.length)
  }

  const dialog = ctx ? (
    <EventConflictDialog title={t('conflict.moveTitle')} conflicts={ctx.items} onResolve={resolve} onCancel={() => setCtx(null)} />
  ) : null

  return { move, dialog }
}
