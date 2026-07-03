import { useRef, useState } from 'react'
import { useAppStore, useAppState, type ImportOutcome } from '../../state'
import { AboutModal } from './AboutModal'
import { ImportResultDialog } from './ImportResultDialog'

function todayStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function SidebarFooter() {
  const app = useAppStore()
  const state = useAppState()
  const [about, setAbout] = useState(false)
  const [result, setResult] = useState<ImportOutcome | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const night = state.theme === 'night'

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
      <button type="button" className="func-row" aria-label="切换主题"
        onClick={() => app.setTheme(night ? 'day' : 'night')}>
        <span className="fr-icon" aria-hidden="true">☾</span>
        <span className="fr-label">夜间模式</span>
        <span className={night ? 'switch on' : 'switch'} aria-hidden="true"><span className="knob" /></span>
      </button>
      <button type="button" className="func-row" onClick={doExport}>
        <span className="fr-icon" aria-hidden="true">⭱</span>
        <span className="fr-label">导出数据</span>
      </button>
      <button type="button" className="func-row" onClick={() => fileRef.current?.click()}>
        <span className="fr-icon" aria-hidden="true">⭳</span>
        <span className="fr-label">导入数据</span>
      </button>
      <button type="button" className="func-row" onClick={() => setAbout(true)}>
        <span className="fr-icon" aria-hidden="true">ⓘ</span>
        <span className="fr-label">关于</span>
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
      {about && <AboutModal onClose={() => setAbout(false)} />}
      {result && <ImportResultDialog outcome={result} onClose={() => setResult(null)} />}
    </div>
  )
}
