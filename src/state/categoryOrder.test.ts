import { describe, it, expect } from 'vitest'
import { reorderedCategories } from './categoryOrder'
import { cat } from '../test/fixtures'

const base = [
  cat({ id: 'a', order: 0 }),
  cat({ id: 'b', order: 1 }),
  cat({ id: 'c', order: 2 }),
  cat({ id: 'a1', parentId: 'a', order: 0 }),
]

describe('reorderedCategories', () => {
  it('drops as a child (append to target children, end)', () => {
    const out = reorderedCategories(base, 'c', 'a', null)
    const c = out.find((x) => x.id === 'c')!
    expect(c.parentId).toBe('a')
    expect(c.order).toBe(1) // after existing child a1 (order 0)
  })

  it('inserts before a sibling at the same level', () => {
    const out = reorderedCategories(base, 'c', null, 'b')
    const byId = Object.fromEntries(out.map((x) => [x.id, x.order]))
    // top-level order becomes a(0), c(1), b(2)
    expect(byId['c']).toBeLessThan(byId['b'])
  })

  it('refuses to move into itself or a descendant', () => {
    expect(reorderedCategories(base, 'a', 'a1', null)).toEqual([])
    expect(reorderedCategories(base, 'a', 'a', null)).toEqual([])
  })
})
