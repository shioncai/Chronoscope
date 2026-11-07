import { useCallback, useState, type ReactNode } from 'react'
import { ModalOverlay } from './ModalOverlay'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useT } from '../../i18n/useT'
import { ConfirmContext, type Ask, type ConfirmOptions } from './useConfirm'

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)
  const ask = useCallback<Ask>((opts) => new Promise<boolean>((resolve) => setReq({ opts, resolve })), [])
  const close = (v: boolean) => {
    req?.resolve(v)
    setReq(null)
  }
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {req && <ConfirmDialog {...req.opts} onClose={close} />}
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger, onClose }: ConfirmOptions & { onClose: (v: boolean) => void }) {
  const t = useT()
  const ref = useFocusTrap<HTMLDivElement>(true, () => onClose(false))
  return (
    <ModalOverlay center onClose={() => onClose(false)}>
      <div className="dialog dialog--confirm" ref={ref} role="alertdialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">{title}</h2>
        {message && <p className="dialog-text">{message}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => onClose(false)}>
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button type="button" className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => onClose(true)}>
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
