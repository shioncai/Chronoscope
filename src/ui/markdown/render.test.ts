// src/ui/features/markdown/render.test.ts
import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './render'

describe('renderMarkdown', () => {
  it('renders bold and headings', () => {
    expect(renderMarkdown('**hi**')).toContain('<strong>hi</strong>')
    expect(renderMarkdown('# Title')).toContain('<h1>')
  })
  it('renders links', () => {
    expect(renderMarkdown('[x](https://example.com)')).toContain('href="https://example.com"')
  })
  it('renders GFM strikethrough', () => {
    expect(renderMarkdown('~~gone~~')).toContain('<del>gone</del>')
  })
  it('renders GFM tables', () => {
    expect(renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')).toContain('<table>')
  })
  it('does not emit live raw HTML', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).not.toContain('<script')
  })
  it('neutralizes javascript: link protocols', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toMatch(/href="javascript:/i)
  })
  it('returns an empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('')
  })
})
