// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { useRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useDismiss } from './useDismiss'

function Harness({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, onClose, true, (t) => (t as Element).closest?.('[data-ignore]') != null)
  return (
    <div>
      <div ref={ref} data-testid="inside">inside</div>
      <button data-testid="outside">outside</button>
      <button data-testid="ignored" data-ignore>ignored</button>
    </div>
  )
}

describe('useDismiss', () => {
  it('closes on outside mousedown and Escape, but not inside or ignored', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    fireEvent.mouseDown(screen.getByTestId('inside')); expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByTestId('ignored')); expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByTestId('outside')); expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' }); expect(onClose).toHaveBeenCalledTimes(2)
  })
})
