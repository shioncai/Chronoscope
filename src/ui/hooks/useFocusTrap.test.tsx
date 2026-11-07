// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFocusTrap } from './useFocusTrap'

function Harness() {
  const [open, setOpen] = useState(false)
  const ref = useFocusTrap<HTMLDivElement>(open, () => setOpen(false))
  return (
    <div>
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <div ref={ref} role="dialog">
          <button>first</button>
          <button>last</button>
        </div>
      )}
    </div>
  )
}

describe('useFocusTrap', () => {
  it('moves focus into the dialog when it opens', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByText('open'))
    expect(document.activeElement).toBe(screen.getByText('first'))
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    render(<Harness />)
    const trigger = screen.getByText('open')
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('wraps Tab from the last focusable back to the first', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByText('open'))
    await userEvent.tab() // first -> last
    expect(document.activeElement).toBe(screen.getByText('last'))
    await userEvent.tab() // last -> wraps to first
    expect(document.activeElement).toBe(screen.getByText('first'))
  })
})
