// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ImportResultDialog } from './ImportResultDialog'

describe('ImportResultDialog', () => {
  it('shows counts on success', () => {
    render(
      <ImportResultDialog
        outcome={{ ok: true, summary: { addedEvents: 2, overwrittenEvents: 1, unchangedEvents: 0, invalidEvents: 0, addedCategories: 1, reusedCategories: 0, addedTags: 0, reusedTags: 0 } }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('新增事件').closest('div')?.textContent).toContain('2')
    expect(screen.getByText(/覆盖事件/).closest('div')?.textContent).toContain('1')
  })

  it('shows the error message on failure', () => {
    render(<ImportResultDialog outcome={{ ok: false, error: '这不是 Chronoscope 导出文件' }} onClose={vi.fn()} />)
    expect(screen.getByText('这不是 Chronoscope 导出文件')).toBeTruthy()
  })
})
