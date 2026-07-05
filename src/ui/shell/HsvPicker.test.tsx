// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HsvPicker } from './HsvPicker'

describe('HsvPicker', () => {
  it('seeds the hex field from value', () => {
    render(<HsvPicker value="#2980b9" onChange={vi.fn()} onCommit={vi.fn()} />)
    expect((screen.getByLabelText('十六进制颜色') as HTMLInputElement).value).toBe('#2980b9')
  })
  it('emits onChange for a valid hex and commits on 加入', async () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(<HsvPicker value="#2980b9" onChange={onChange} onCommit={onCommit} />)
    fireEvent.change(screen.getByLabelText('十六进制颜色'), { target: { value: '#ff0000' } })
    expect(onChange).toHaveBeenCalledWith('#ff0000')
    await userEvent.click(screen.getByRole('button', { name: '加入' }))
    expect(onCommit).toHaveBeenCalledWith('#ff0000')
  })
  it('ignores an invalid hex (no onChange)', () => {
    const onChange = vi.fn()
    render(<HsvPicker value="#2980b9" onChange={onChange} onCommit={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('十六进制颜色'), { target: { value: 'zzz' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})
