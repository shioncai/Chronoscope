import { useRef, useState } from 'react'
import { useAppStore, useAppState, type ImportOutcome } from '../../state'
import { AboutModal } from './AboutModal'
import { ImportResultDialog } from './ImportResultDialog'
import { LanguageMenu } from './LanguageMenu'
import { useT, useLocale } from '../../i18n/useT'
import { SUPPORTED_LOCALES } from '../../i18n/locales'

function todayStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function SidebarFooter() {
  const app = useAppStore()
  const state = useAppState()
  const t = useT()
  const locale = useLocale()
  const [about, setAbout] = useState(false)
  const [result, setResult] = useState<ImportOutcome | null>(null)
  const [langOpen, setLangOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const langBtnRef = useRef<HTMLButtonElement>(null)
  const night = state.theme === 'night'
  const currentName = SUPPORTED_LOCALES.find((l) => l.code === locale)?.name ?? locale

  function doExport() {
    const text = JSON.stringify(app.exportData(), null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chronoscope-${todayStamp()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const file = input.files?.[0]
    input.value = '' // allow re-selecting the same file later
    if (!file) return
    const text = await file.text()
    setResult(await app.importData(text))
  }

  return (
    <div className="func-bar">
      <button type="button" className="func-row" ref={langBtnRef} aria-haspopup="menu" aria-expanded={langOpen}
        aria-label={t('sidebar.language')} onClick={() => setLangOpen((o) => !o)}>
        <span className="fr-icon" aria-hidden="true">🌐</span>
        <span className="fr-label">{t('sidebar.language')}</span>
        <span className="fr-value">{currentName}</span>
      </button>
      <button type="button" className="func-row" aria-label={t('sidebar.toggleTheme')}
        onClick={() => app.setTheme(night ? 'day' : 'night')}>
        <span className="fr-icon" aria-hidden="true">☾</span>
        <span className="fr-label">{t('sidebar.nightMode')}</span>
        <span className={night ? 'switch on' : 'switch'} aria-hidden="true"><span className="knob" /></span>
      </button>
      <button type="button" className="func-row" onClick={doExport}>
        <span className="fr-icon" aria-hidden="true">⭱</span>
        <span className="fr-label">{t('sidebar.exportData')}</span>
      </button>
      <button type="button" className="func-row" onClick={() => fileRef.current?.click()}>
        <span className="fr-icon" aria-hidden="true">⭳</span>
        <span className="fr-label">{t('sidebar.importData')}</span>
      </button>
      <button type="button" className="func-row" onClick={() => setAbout(true)}>
        <span className="fr-icon" aria-hidden="true">ⓘ</span>
        <span className="fr-label">{t('sidebar.about')}</span>
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
      {langOpen && (
        <LanguageMenu anchorRef={langBtnRef} current={locale}
          onPick={(code) => { app.setLocale(code); setLangOpen(false) }}
          onClose={() => setLangOpen(false)} />
      )}
      {about && <AboutModal onClose={() => setAbout(false)} />}
      {result && <ImportResultDialog outcome={result} onClose={() => setResult(null)} />}
    </div>
  )
}
