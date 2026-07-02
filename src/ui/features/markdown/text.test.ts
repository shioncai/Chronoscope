// src/ui/features/markdown/text.test.ts
import { describe, it, expect } from 'vitest'
import { markdownToText } from './text'

describe('markdownToText', () => {
  it('strips markdown syntax to clean inline text', () => {
    expect(markdownToText('# 标题\n\n**加粗** 和 ~~删除~~')).toBe('标题 加粗 和 删除')
  })
  it('flattens lists onto one line', () => {
    expect(markdownToText('- 一\n- 二')).toBe('一 二')
  })
  it('keeps link text but drops the url', () => {
    expect(markdownToText('[链接](https://example.com) 与其它')).toBe('链接 与其它')
  })
  it('decodes escaped entities', () => {
    expect(markdownToText('a < b & c')).toBe('a < b & c')
  })
  it('returns an empty string for empty input', () => {
    expect(markdownToText('')).toBe('')
  })
})
