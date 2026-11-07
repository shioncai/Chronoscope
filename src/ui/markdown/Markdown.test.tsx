// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('renders markdown source as HTML', async () => {
    const { container } = render(<Markdown source="**bold**" />)
    await waitFor(() => expect(container.querySelector('.markdown strong')?.textContent).toBe('bold'))
  })
  it('does not inject a raw script element', async () => {
    const { container } = render(<Markdown source="<script>alert(1)</script>" />)
    await waitFor(() => expect(container.querySelector('.markdown--loading')).toBeNull())
    expect(container.querySelector('script')).toBeNull()
  })
})
