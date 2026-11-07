import { describe, it, expect } from 'vitest'
import { translate, tn } from './t'

describe('translate', () => {
  it('returns the catalog string for the locale', () => {
    expect(translate('en', 'common.cancel')).toBe('Cancel')
    expect(translate('zh', 'common.cancel')).toBe('取消')
  })
  it('interpolates {params}', () => {
    expect(translate('en', 'common.selectEvent', { title: 'X' })).toBe('Select "X"')
  })
  it('tn selects the plural form and injects n', () => {
    expect(tn('en', 'toast.deleted', 1)).toBe('Moved 1 event to the recycle bin')
    expect(tn('en', 'toast.deleted', 3)).toBe('Moved 3 events to the recycle bin')
    expect(tn('zh', 'toast.deleted', 3)).toBe('已将 3 个事件移入回收站')
  })
})
