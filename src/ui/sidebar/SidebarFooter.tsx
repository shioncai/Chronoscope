import { useRef, useState } from 'react'
import { useAppStore, useAppSelector } from '../../state'
import type { ThemeMode } from '../../state'
import { AboutModal } from '../dialogs/AboutModal'
import { Icon, type IconName } from '../components/Icon'
import { Popover, MenuItem } from '../components/Popover'
import { useDataTransfer } from '../app/useDataTransfer'
import { useT, useLocale } from '../../i18n/useT'
import { SUPPORTED_LOCALES } from '../../i18n/locales'
import type { MessageKey } from '../../i18n/catalog'

const THEMES: { mode: ThemeMode; icon: IconName; label: MessageKey }[] = [
  { mode: 'system', icon: 'monitor', label: 'sidebar.themeSystem' },
  { mode: 'day', icon: 'sun', label: 'sidebar.themeDay' },
  { mode: 'night', icon: 'moon', label: 'sidebar.themeNight' },
]

const prefersDark = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches

export function SidebarFooter({ onHelp }: { onHelp?: () => void }) {
  const app = useAppStore()
  const t = useT()
  const locale = useLocale()
  const data = useDataTransfer()
  const themeMode = useAppSelector((s) => s.themeMode)
  const [about, setAbout] = useState(false)
  const [menu, setMenu] = useState<'export' | 'lang' | null>(null)
  const exportRef = useRef<HTMLButtonElement>(null)
  const langRef = useRef<HTMLButtonElement>(null)
  const currentName = SUPPORTED_LOCALES.find((l) => l.code === locale)?.name ?? locale
  const toggle = (m: 'export' | 'lang') => setMenu((cur) => (cur === m ? null : m))

  return (
    <div className="sidebar-footer">
      <div className="footer-data">
        <button type="button" className="btn btn-sm" onClick={data.openImport}>
          <Icon name="upload" size={15} />
          <span>{t('sidebar.importData')}</span>
        </button>
        <button type="button" className="btn btn-sm" ref={exportRef} aria-haspopup="menu" aria-expanded={menu === 'export'}
          onClick={() => toggle('export')}>
          <Icon name="download" size={15} />
          <span>{t('sidebar.exportData')}</span>
          <Icon name="chevronDown" size={13} className="caret" />
        </button>
      </div>
      <div className="footer-prefs">
        <div className="segmented segmented--icons" role="radiogroup" aria-label={t('sidebar.theme')}>
          {THEMES.map((th) => (
            <button key={th.mode} type="button" role="radio" aria-checked={themeMode === th.mode}
              className={themeMode === th.mode ? 'is-active' : ''} aria-label={t(th.label)} title={t(th.label)}
              onClick={() => app.setThemeMode(th.mode, prefersDark())}>
              <Icon name={th.icon} size={15} />
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn lang-btn" ref={langRef} aria-haspopup="menu" aria-expanded={menu === 'lang'}
          aria-label={t('sidebar.language')} title={t('sidebar.language')} onClick={() => toggle('lang')}>
          <Icon name="globe" size={16} />
          <span>{currentName}</span>
        </button>
        <span className="footer-spacer" />
        {onHelp && (
          <button type="button" className="icon-btn" aria-label={t('sidebar.shortcuts')} title={`${t('sidebar.shortcuts')} (?)`} onClick={onHelp}>
            <Icon name="keyboard" size={17} />
          </button>
        )}
        <button type="button" className="icon-btn" aria-label={t('sidebar.about')} title={t('sidebar.about')} onClick={() => setAbout(true)}>
          <Icon name="info" size={17} />
        </button>
      </div>
      {menu === 'export' && (
        <Popover anchorRef={exportRef} onClose={() => setMenu(null)} placement={['above', 'below']} label={t('sidebar.exportData')}>
          <MenuItem onClick={() => { setMenu(null); void data.exportJson() }}>
            <Icon name="file" size={15} />
            <span className="menu-text">
              <span>{t('sidebar.exportJson')}</span>
              <small>{t('sidebar.exportJsonHint')}</small>
            </span>
          </MenuItem>
          <MenuItem onClick={() => { setMenu(null); void data.exportCsv() }}>
            <Icon name="list" size={15} />
            <span className="menu-text">
              <span>{t('sidebar.exportCsv')}</span>
              <small>{t('sidebar.exportCsvHint')}</small>
            </span>
          </MenuItem>
        </Popover>
      )}
      {menu === 'lang' && (
        <Popover anchorRef={langRef} onClose={() => setMenu(null)} placement={['above', 'below']} label={t('sidebar.language')}>
          {SUPPORTED_LOCALES.map((l) => (
            <MenuItem key={l.code} checked={l.code === locale} onClick={() => { app.setLocale(l.code); setMenu(null) }}>
              <Icon name="check" size={15} className="menu-check" />
              <span>{l.name}</span>
            </MenuItem>
          ))}
        </Popover>
      )}
      {about && <AboutModal onClose={() => setAbout(false)} />}
    </div>
  )
}
