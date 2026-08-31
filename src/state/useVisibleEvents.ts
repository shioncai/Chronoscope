import { useMemo } from 'react'
import type { EventRecord } from '../domain/model'
import { useAppState } from './context'
import { visibleEvents } from './selectors'

/**
 * The filtered + sorted events that the list and the timeline both render.
 *
 * Memoized on the slices `visibleEvents` actually reads — NOT on the whole
 * state object. The timeline writes its pan/zoom (and the selection) into the
 * store, so a dependency on the state object as a whole re-filtered and
 * re-sorted every event on every frame of a drag, for a result that could not
 * have changed.
 */
export function useVisibleEvents(): EventRecord[] {
  const { events, categories, tags, filter, sort } = useAppState()
  return useMemo(
    () => visibleEvents({ events, categories, tags, filter, sort }),
    [events, categories, tags, filter, sort],
  )
}
