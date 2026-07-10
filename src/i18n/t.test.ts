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
    expect(tn('en', 'list.deleteConfirm', 1)).toBe('Delete the 1 selected event?')
    expect(tn('en', 'list.deleteConfirm', 3)).toBe('Delete the 3 selected events?')
    expect(tn('zh', 'list.deleteConfirm', 3)).toBe('删除选中的 3 个事件?')
  })
})
