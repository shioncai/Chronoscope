// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagMenu } from './TagMenu'
import { tag } from '../../test/fixtures'

describe('TagMenu', () => {
  it('renders a menuitem per tag and reports the chosen id', async () => {
    const onPick = vi.fn()
    render(<TagMenu tags={[tag({ id: 't1', name: '里程碑' }), tag({ id: 't2', name: '科技' })]} onPick={onPick} />)
    await userEvent.click(screen.getByRole('menuitem', { name: '里程碑' }))
    expect(onPick).toHaveBeenCalledWith('t1')
  })

  it('shows the caller-supplied placeholder and no menuitems when there are no tags', () => {
    // TagMenu is presentational (no i18n access), so the caller supplies the
    // localized placeholder; the component itself defaults to '' when omitted.
    render(<TagMenu tags={[]} onPick={vi.fn()} emptyLabel="无标签" />)
    expect(screen.getByText('无标签')).toBeTruthy()
    expect(screen.queryByRole('menuitem')).toBeNull()
  })
})
