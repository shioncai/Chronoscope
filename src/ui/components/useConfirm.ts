import { createContext, useContext } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Paint the confirm button as destructive. */
  danger?: boolean
}

export type Ask = (o: ConfirmOptions) => Promise<boolean>

// Outside a provider (a component rendered on its own in a test) fall back to
// the browser's dialog, so behaviour degrades instead of silently refusing.
export const ConfirmContext = createContext<Ask>(async (o) =>
  typeof window !== 'undefined' && typeof window.confirm === 'function'
    ? window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title)
    : false,
)

/** Ask a yes/no question in an in-app dialog; resolves true on confirm. */
export const useConfirm = (): Ask => useContext(ConfirmContext)
