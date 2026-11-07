import type { AxisKind } from '../domain/time'
import type { AppState, Sort, View } from './types'

/**
 * The view preferences that survive a reload: which view, how the list is
 * sorted, and how the timeline is drawn. Data never lives here — this is a
 * per-device convenience in localStorage, not part of an export.
 */
export interface Prefs {
  view: View
  sort: Sort
  timelineAxis: AxisKind
  timelineLanes: boolean
  timelineScale: number
}

export const PREFS_STORAGE_KEY = 'chronoscope.prefs'

const SORT_KEYS: Sort['key'][] = ['start', 'title', 'category', 'tags', 'note', 'updated']

/** Read what is valid and drop the rest, so a stale or hand-edited entry can
 *  never put the app into a state it does not know. */
export function parsePrefs(raw: string | null): Partial<Prefs> {
  if (!raw) return {}
  let obj: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    obj = parsed as Record<string, unknown>
  } catch {
    return {}
  }
  const out: Partial<Prefs> = {}
  if (obj.view === 'list' || obj.view === 'timeline') out.view = obj.view
  const sort = obj.sort as Partial<Sort> | undefined
  if (sort && SORT_KEYS.includes(sort.key as Sort['key']) && (sort.dir === 'asc' || sort.dir === 'desc')) {
    out.sort = { key: sort.key as Sort['key'], dir: sort.dir }
  }
  if (obj.timelineAxis === 'linear' || obj.timelineAxis === 'log') out.timelineAxis = obj.timelineAxis
  if (typeof obj.timelineLanes === 'boolean') out.timelineLanes = obj.timelineLanes
  if (typeof obj.timelineScale === 'number' && obj.timelineScale >= 1 && obj.timelineScale <= 2.5) {
    out.timelineScale = obj.timelineScale
  }
  return out
}

export function loadPrefs(storage: Pick<Storage, 'getItem'>): Partial<Prefs> {
  try {
    return parsePrefs(storage.getItem(PREFS_STORAGE_KEY))
  } catch {
    return {}
  }
}

export function prefsOf(s: AppState): Prefs {
  return {
    view: s.view,
    sort: s.sort,
    timelineAxis: s.timelineAxis,
    timelineLanes: s.timelineLanes,
    timelineScale: s.timelineScale,
  }
}

export function savePrefs(storage: Pick<Storage, 'setItem'>, prefs: Prefs): void {
  try {
    storage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // storage full or blocked: the preference simply does not survive a reload
  }
}
