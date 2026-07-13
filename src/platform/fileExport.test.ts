// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { saveTextFile } from './fileExport'

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

  it('releases the object URL', async () => {
    await saveTextFile('x.json', '{}')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })
})
