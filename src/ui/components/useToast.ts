import { createContext, useContext } from 'react'

export interface ToastOptions {
  message: string
  /** One follow-up, typically Undo. Running it dismisses the toast. */
  action?: { label: string; run: () => void }
  /** ms on screen; hovering pauses the clock. */
  duration?: number
}

export type Push = (t: ToastOptions) => void
export const ToastContext = createContext<Push>(() => {})

/** Show a brief, non-blocking message. No-op outside a ToastProvider. */
export const useToast = (): Push => useContext(ToastContext)
