import { useMemo } from 'react'
import { useAppSelector, shallowEqual } from '../../state'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { ModalOverlay } from '../components/ModalOverlay'
import { Icon, Mark } from '../components/Icon'
import { useT } from '../../i18n/useT'

const REPO = 'https://github.com/ShionChoy/Chronoscope'

export function AboutModal({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(true, onClose)
  const t = useT()
  const { events, categories, tags } = useAppSelector(
    (s) => ({ events: s.events, categories: s.categories, tags: s.tags }),
    shallowEqual,
  )
  const stats = useMemo(
    () => [
      { label: t('about.events'), n: events.filter((e) => !e.deleted).length },
      { label: t('about.folders'), n: categories.filter((c) => !c.deleted).length },
      { label: t('about.tags'), n: tags.filter((x) => !x.deleted).length },
    ],
    [events, categories, tags, t],
  )
  return (
    <ModalOverlay center onClose={onClose}>
      <div className="dialog dialog--about" ref={ref} role="dialog" aria-modal="true" aria-label={t('sidebar.about')}
        onClick={(e) => e.stopPropagation()}>
        <div className="about-head">
          <Mark size={48} />
          <div>
            <div className="about-name">Chronoscope</div>
            <div className="about-ver">v{__APP_VERSION__} · {t('about.tagline')}</div>
          </div>
        </div>
        <p className="dialog-text">{t('about.description')}</p>
        <dl className="about-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.n}</dd>
            </div>
          ))}
        </dl>
        <dl className="about-meta">
          <div><dt>{t('about.author')}</dt><dd>ShionChoy</dd></div>
          <div><dt>{t('about.storage')}</dt><dd>{t('about.storageValue')}</dd></div>
        </dl>
        <div className="dialog-actions">
          <a className="btn" href={REPO} target="_blank" rel="noreferrer noopener">
            <Icon name="link" size={15} />
            <span>{t('about.source')}</span>
          </a>
          <button type="button" className="btn btn-primary" data-autofocus onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </ModalOverlay>
  )
}
