// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('renders markdown source as HTML', () => {
    const { container } = render(<Markdown source="**bold**" />)
    expect(container.querySelector('.markdown strong')?.textContent).toBe('bold')
  })
  it('does not inject a raw script element', () => {
    const { container } = render(<Markdown source="<script>alert(1)</script>" />)
    expect(container.querySelector('script')).toBeNull()
  })
})
