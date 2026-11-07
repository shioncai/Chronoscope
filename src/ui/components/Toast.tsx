import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { ToastContext, type Push, type ToastOptions } from './useToast'

interface ToastItem extends ToastOptions {
  id: number
}

const MAX_VISIBLE = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const push = useCallback<Push>((t) => {
    const id = ++seq.current
    setToasts((ts) => [...ts.slice(-(MAX_VISIBLE - 1)), { ...t, id }])
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <Toast key={t.id} item={t} onDone={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function Toast({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const [paused, setPaused] = useState(false)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => done.current(), item.duration ?? (item.action ? 6000 : 3500))
    return () => clearTimeout(timer)
  }, [paused, item.duration, item.action])
  return (
    <div className="toast" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <span className="toast-msg">{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            item.action!.run()
            onDone()
          }}
        >
          {item.action.label}
        </button>
      )}
      <button type="button" className="toast-close" aria-label="×" onClick={onDone}>
        <Icon name="close" size={14} />
      </button>
    </div>
  )
}
