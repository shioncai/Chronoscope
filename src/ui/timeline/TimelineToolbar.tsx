import { useRef, useState } from 'react'
import type { AxisKind } from '../../domain/time'
import { Icon } from '../components/Icon'
import { Popover } from '../components/Popover'
import { useT } from '../../i18n/useT'

export interface TimelineToolbarProps {
  axis: AxisKind
  lanes: boolean
  scale: number
  /** What the detail window currently spans, as words: "≈ 36 years". */
  span: string
  onZoom: (factor: number) => void
  onFit: () => void
  onNow: () => void
  onAxis: (axis: AxisKind) => void
  onLanes: (on: boolean) => void
  onScale: (delta: number) => void
  onResetScale: () => void
  onExportImage: () => void
}

export function TimelineToolbar(p: TimelineToolbarProps) {
  const t = useT()
  const [opts, setOpts] = useState(false)
  const optsRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="tl-toolbar" role="toolbar" aria-label={t('timeline.toolbar')}>
      <div className="tool-group">
        <button type="button" className="icon-btn" aria-label={t('timeline.zoomOut')} title={`${t('timeline.zoomOut')} (−)`} onClick={() => p.onZoom(1 / 0.7)}>
          <Icon name="zoomOut" size={17} />
        </button>
        <button type="button" className="icon-btn" aria-label={t('timeline.zoomIn')} title={`${t('timeline.zoomIn')} (+)`} onClick={() => p.onZoom(0.7)}>
          <Icon name="zoomIn" size={17} />
        </button>
        <button type="button" className="btn btn-sm btn-quiet" title={`${t('timeline.fit')} (0)`} onClick={p.onFit}>
          <Icon name="fit" size={15} />
          <span className="tool-label">{t('timeline.fit')}</span>
        </button>
        <button type="button" className="btn btn-sm btn-quiet" title={`${t('timeline.now')} (T)`} onClick={p.onNow}>
          <Icon name="now" size={15} />
          <span className="tool-label">{t('timeline.now')}</span>
        </button>
      </div>
      <span className="tl-span mono" aria-live="polite">{p.span}</span>
      <div className="tool-group">
        <div className="segmented segmented--sm" role="radiogroup" aria-label={t('timeline.axis')}>
          <button type="button" role="radio" aria-checked={p.axis === 'linear'} className={p.axis === 'linear' ? 'is-active' : ''}
            title={`${t('timeline.axisLinearHint')} (L)`} onClick={() => p.onAxis('linear')}>
            <Icon name="linearScale" size={14} />
            <span className="tool-label">{t('timeline.axisLinear')}</span>
          </button>
          <button type="button" role="radio" aria-checked={p.axis === 'log'} className={p.axis === 'log' ? 'is-active' : ''}
            title={`${t('timeline.axisLogHint')} (L)`} onClick={() => p.onAxis('log')}>
            <Icon name="logScale" size={14} />
            <span className="tool-label">{t('timeline.axisLog')}</span>
          </button>
        </div>
        <button type="button" className={p.lanes ? 'icon-btn is-on' : 'icon-btn'} aria-pressed={p.lanes}
          aria-label={t('timeline.lanes')} title={`${t('timeline.lanes')} (G)`} onClick={() => p.onLanes(!p.lanes)}>
          <Icon name="layers" size={17} />
        </button>
        <button type="button" className="icon-btn" ref={optsRef} aria-haspopup="dialog" aria-expanded={opts}
          aria-label={t('timeline.options')} title={t('timeline.options')} onClick={() => setOpts((o) => !o)}>
          <Icon name="sliders" size={17} />
        </button>
      </div>
      {opts && (
        <Popover anchorRef={optsRef} onClose={() => setOpts(false)} role="dialog" label={t('timeline.options')} className="tl-options">
          <div className="opt-row">
            <span>{t('timeline.zoomGroup')}</span>
            <div className="stepper" role="group" aria-label={t('timeline.zoomGroup')}>
              <button type="button" aria-label={t('timeline.sizeDown')} disabled={p.scale <= 1} onClick={() => p.onScale(-0.25)}>
                <Icon name="minus" size={14} />
              </button>
              <button type="button" className="stepper-value" aria-label={t('timeline.zoomReset')} onClick={p.onResetScale}>
                {p.scale.toFixed(2).replace(/\.?0+$/, '')}×
              </button>
              <button type="button" aria-label={t('timeline.sizeUp')} disabled={p.scale >= 2.5} onClick={() => p.onScale(0.25)}>
                <Icon name="plus" size={14} />
              </button>
            </div>
          </div>
          <button type="button" className="menu-item" onClick={() => { setOpts(false); p.onExportImage() }}>
            <Icon name="image" size={15} />
            <span>{t('timeline.exportImage')}</span>
          </button>
        </Popover>
      )}
    </div>
  )
}
