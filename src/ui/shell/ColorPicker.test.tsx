// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColorPicker } from './ColorPicker'

const grid = [['#abcdef', '#123456'], ['#0d7d8c', '#8e44ad']] as const

beforeEach(() => window.localStorage.clear())

describe('ColorPicker', () => {
  it('renders the preset grid and calls onPick on a swatch', async () => {
    const onPick = vi.fn()
    render(<ColorPicker value="#000000" presets={grid} onPick={onPick} onClose={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('颜色 #abcdef'))
    expect(onPick).toHaveBeenCalledWith('#abcdef')
  })
  it('marks the swatch matching value as selected (case-insensitive)', () => {
    render(<ColorPicker value="#ABCDEF" presets={grid} onPick={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByLabelText('颜色 #abcdef').className).toContain('selected')
    expect(screen.getByLabelText('颜色 #123456').className).not.toContain('selected')
  })
  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<ColorPicker value="#000000" presets={grid} onPick={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
  it('opens the HSV picker from ＋', async () => {
    render(<ColorPicker value="#000000" presets={grid} onPick={vi.fn()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('自定义颜色'))
    expect(screen.getByLabelText('十六进制颜色')).toBeTruthy()
  })
})
