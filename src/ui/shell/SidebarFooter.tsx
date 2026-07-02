import { useState } from 'react'
import { useAppStore, useAppState } from '../../state'
import { AboutModal } from './AboutModal'

export function SidebarFooter() {
  const app = useAppStore()
  const state = useAppState()
  const [about, setAbout] = useState(false)
  const night = state.theme === 'night'
  return (
    <div className="func-bar">
      <button type="button" className="func-row" aria-label="切换主题"
        onClick={() => app.setTheme(night ? 'day' : 'night')}>
        <span className="fr-icon" aria-hidden="true">☾</span>
        <span className="fr-label">夜间模式</span>
        <span className={night ? 'switch on' : 'switch'} aria-hidden="true"><span className="knob" /></span>
      </button>
      <button type="button" className="func-row" onClick={() => setAbout(true)}>
        <span className="fr-icon" aria-hidden="true">ⓘ</span>
        <span className="fr-label">关于</span>
      </button>
      {about && <AboutModal onClose={() => setAbout(false)} />}
    </div>
  )
}
