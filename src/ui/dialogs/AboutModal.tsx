import { useFocusTrap } from '../hooks/useFocusTrap'
import { ModalOverlay } from '../components/ModalOverlay'
import { useT } from '../../i18n/useT'

export function AboutModal({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(true, onClose)
  const t = useT()
  return (
    <ModalOverlay center onClose={onClose}>
      <div className="info-card" ref={ref} role="dialog" aria-modal="true" aria-label={t('sidebar.about')}
        onClick={(e) => e.stopPropagation()}>
        <div className="logo display">Chronoscope</div>
        <div className="ver mono">v{__APP_VERSION__} · {t('about.tagline')}</div>
        <p>{t('about.description')}</p>
        <div className="meta">
          <div><span>{t('about.author')}</span><b>ShionChoy</b></div>
          <div><span>{t('about.stack')}</span><b>React · Dexie · Canvas</b></div>
          <div><span>{t('about.license')}</span><b>MIT</b></div>
        </div>
        <button type="button" className="close" onClick={onClose}>{t('common.close')}</button>
      </div>
    </ModalOverlay>
  )
}
