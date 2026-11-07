// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { saveTextFile } from './fileExport'

// Pin these to the web branch. The native branch is thin glue over two Capacitor
// plugins; asserting it against a mock of the very API under test would prove
// nothing, so it is verified on the device instead.
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))

describe('saveTextFile (web)', () => {
  let clicked: HTMLAnchorElement | null = null

  beforeEach(() => {
    clicked = null
    // jsdom implements neither object URLs nor navigation on click, so stub the
    // two edges we care about and assert on the anchor we handed the browser.
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag)
      if (tag === 'a') {
        const a = el as HTMLAnchorElement
        a.click = () => {
          clicked = a
        }
      }
      return el
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('downloads the text under the given filename', async () => {
    await saveTextFile('chronoscope-2026-07-13.json', '{"a":1}')
    expect(clicked).not.toBeNull()
    expect(clicked!.download).toBe('chronoscope-2026-07-13.json')
    expect(clicked!.href).toBe('blob:fake')
  })

  it('releases the object URL once the download has had time to start', async () => {
    vi.useFakeTimers()
    try {
      await saveTextFile('x.json', '{}')
      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1000)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    } finally {
      vi.useRealTimers()
    }
  })

  it('puts the anchor in the document for the click, then removes it', async () => {
    await saveTextFile('x.json', '{}')
    expect(clicked!.isConnected).toBe(false)
    expect(document.querySelector('a[download]')).toBeNull()
  })

  // Tauri is detected by a global it stamps on the window, so a browser and the
  // Electron shell — where that global is absent — must never take that branch.
  // If they did, export would try to import an SDK that isn't there and die.
  it('does not take the Tauri branch when the Tauri global is absent', async () => {
    expect('__TAURI_INTERNALS__' in window).toBe(false)
    await saveTextFile('x.json', '{}')
    expect(clicked).not.toBeNull() // the download path ran
  })
})

describe('saveTextFile (Tauri)', () => {
  const saveMock = vi.fn()
  const writeMock = vi.fn()

  beforeEach(() => {
    saveMock.mockReset().mockResolvedValue('C:\\Users\\me\\chronoscope.json')
    writeMock.mockReset().mockResolvedValue(undefined)
    vi.doMock('@tauri-apps/plugin-dialog', () => ({ save: saveMock }))
    vi.doMock('@tauri-apps/plugin-fs', () => ({ writeTextFile: writeMock }))
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  })

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    vi.doUnmock('@tauri-apps/plugin-dialog')
    vi.doUnmock('@tauri-apps/plugin-fs')
    vi.resetModules()
  })

  // WebView2 silently drops an <a download>, which is why "Export" did nothing at
  // all in the Tauri build. It has to go out through a native save dialog.
  it('asks where to save, then writes there', async () => {
    const { saveTextFile: save } = await import('./fileExport')
    await save('chronoscope-2026-07-13.json', '{"a":1}')

    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: 'chronoscope-2026-07-13.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    expect(writeMock).toHaveBeenCalledWith('C:\\Users\\me\\chronoscope.json', '{"a":1}')
  })

  it('writes nothing when the user cancels the dialog', async () => {
    saveMock.mockResolvedValue(null)
    const { saveTextFile: save } = await import('./fileExport')
    expect(await save('x.json', '{}')).toBe(false)
    expect(writeMock).not.toHaveBeenCalled()
  })

  it('writes binary data through the binary API with a matching filter', async () => {
    const binMock = vi.fn().mockResolvedValue(undefined)
    vi.doMock('@tauri-apps/plugin-fs', () => ({ writeTextFile: writeMock, writeFile: binMock }))
    const { saveFile } = await import('./fileExport')
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    // jsdom's Blob lacks arrayBuffer in some versions; give it one
    if (!blob.arrayBuffer) Object.assign(blob, { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })
    await saveFile('t.png', blob, 'image/png')
    expect(saveMock).toHaveBeenCalledWith({ defaultPath: 't.png', filters: [{ name: 'PNG', extensions: ['png'] }] })
    expect(binMock).toHaveBeenCalledTimes(1)
    expect(Array.from(binMock.mock.calls[0][1] as Uint8Array)).toEqual([1, 2, 3])
  })
})
