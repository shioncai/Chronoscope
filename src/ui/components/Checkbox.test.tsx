// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('renders a checkbox role with an accessible label and unchecked aria state', () => {
    render(<Checkbox state="unchecked" label="选择 X" onClick={() => {}} />)
    const cb = screen.getByRole('checkbox', { name: '选择 X' })
    expect(cb.tagName).toBe('BUTTON')
    expect(cb.getAttribute('aria-checked')).toBe('false')
  })

  it('reflects checked and indeterminate via aria-checked', () => {
    const { rerender } = render(<Checkbox state="checked" label="a" onClick={() => {}} />)
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true')
    rerender(<Checkbox state="indeterminate" label="a" onClick={() => {}} />)
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('mixed')
  })

  it('uses the shared .tree-cb styling classes', () => {
    render(<Checkbox state="checked" label="a" onClick={() => {}} />)
    const cb = screen.getByRole('checkbox')
    expect(cb.classList.contains('tree-cb')).toBe(true)
    expect(cb.classList.contains('cb-checked')).toBe(true)
  })

  it('calls onClick and stops propagation so a parent row click does not fire', async () => {
    const onClick = vi.fn()
    const parent = vi.fn()
    render(
      <div onClick={parent}>
        <Checkbox state="unchecked" label="a" onClick={onClick} />
      </div>,
    )
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(parent).not.toHaveBeenCalled()
  })
})
