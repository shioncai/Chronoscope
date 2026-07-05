// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { useFlyout } from './useFlyout'

function Harness() {
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const style = useFlyout({ left: 10, top: 10, width: 20, height: 20 }, panelRef, open)
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      {open && createPortal(<div ref={panelRef} data-testid="flyout" style={style}>panel</div>, document.body)}
    </>
  )
}

describe('useFlyout', () => {
  it('portals the panel to the body only when open, with fixed positioning', () => {
    render(<Harness />)
    expect(screen.queryByTestId('flyout')).toBeNull()
    fireEvent.click(screen.getByText('open'))
    const el = screen.getByTestId('flyout')
    expect(el.parentElement).toBe(document.body)
    expect(el.style.position).toBe('fixed')
  })
})
