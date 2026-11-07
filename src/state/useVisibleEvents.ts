import { useMemo } from 'react'
import type { EventRecord } from '../domain/model'
import { useAppSelector } from './context'
import { visibleEvents } from './selectors'

/**
 * The filtered + sorted events that the list and the timeline both render.
 *
 * Subscribed to — and memoized on — exactly the slices `visibleEvents` reads,
 * NOT the whole state object. The timeline writes its pan/zoom into the store
 * on every frame of a drag; a dependency on the state as a whole re-filtered
 * and re-sorted every event each frame for a result that could not change.
 */
export function useVisibleEvents(): EventRecord[] {
  const events = useAppSelector((s) => s.events)
  const categories = useAppSelector((s) => s.categories)
  const tags = useAppSelector((s) => s.tags)
  const filter = useAppSelector((s) => s.filter)
  const sort = useAppSelector((s) => s.sort)
  return useMemo(
    () => visibleEvents({ events, categories, tags, filter, sort }),
    [events, categories, tags, filter, sort],
  )
}
