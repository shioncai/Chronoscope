import { useAppSelector } from '../../state'

export type EmptyKind = 'welcome' | 'filtered' | 'trash'

/** Which empty state fits the current filter. */
export function useEmptyKind(): EmptyKind {
  return useAppSelector((s) => {
    if (s.filter.trash) return 'trash'
    const anyLive = s.events.some((e) => !e.deleted)
    return anyLive ? 'filtered' : 'welcome'
  })
}
