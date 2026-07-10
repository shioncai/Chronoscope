// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { LanguageMenu } from './LanguageMenu'

describe('LanguageMenu', () => {
  it('lists supported locales and marks the current one', () => {
    render(<LanguageMenu anchorRef={createRef()} current="zh" onPick={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('menuitemradio', { name: '中文' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('menuitemradio', { name: 'English' }).getAttribute('aria-checked')).toBe('false')
  })
  it('calls onPick with the chosen code', async () => {
    const onPick = vi.fn()
    render(<LanguageMenu anchorRef={createRef()} current="zh" onPick={onPick} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'English' }))
    expect(onPick).toHaveBeenCalledWith('en')
  })
})
