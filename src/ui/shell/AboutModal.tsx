import { useFocusTrap } from './useFocusTrap'

export function AboutModal({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(true, onClose)
  return (
    <div className="modal-overlay modal-overlay--center" onClick={onClose}>
      <div className="info-card" ref={ref} role="dialog" aria-modal="true" aria-label="关于"
        onClick={(e) => e.stopPropagation()}>
        <div className="logo display">Chronoscope</div>
        <div className="ver mono">v0.1.0 · 本地优先时间轴</div>
        <p>跨尺度的事件时间轴 PWA。数据完全保存在本地，无需服务器、无需账号。</p>
        <div className="meta">
          <div><span>作者</span><b>ShionChoy</b></div>
          <div><span>技术栈</span><b>React · Dexie · Canvas</b></div>
          <div><span>许可</span><b>MIT</b></div>
        </div>
        <button type="button" className="close" onClick={onClose}>关闭</button>
      </div>
    </div>
  )
}
