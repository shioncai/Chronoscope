// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AboutModal } from './AboutModal'

describe('AboutModal', () => {
  it('renders app name and closes on the close button', async () => {
    const onClose = vi.fn()
    render(<AboutModal onClose={onClose} />)
    expect(screen.getByText('Chronoscope')).toBeTruthy()
    expect(screen.getByText(/本地优先/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalled()
  })
})
