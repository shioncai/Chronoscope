import { describe, it, expect } from 'vitest'
import {
  descendantCategoryIds, EMPTY_SCOPE, isScopeEmpty, scopedCategoryIds, isMember,
  memberEventIds, folderCheckStates, toggleFolder, toggleEvent, soloFolder,
} from './scope'
import type { Scope } from './types'
import { ev, cat } from '../test/fixtures'

const S = (o: Partial<Scope> = {}): Scope => ({ ...EMPTY_SCOPE, ...o })

describe('descendantCategoryIds', () => {
  it('includes the root and all descendants, skipping deleted', () => {
    const cats = [
      cat({ id: 'a' }), cat({ id: 'b', parentId: 'a' }), cat({ id: 'c', parentId: 'b' }),
      cat({ id: 'd', parentId: 'a', deleted: true }), cat({ id: 'x' }),
    ]
    expect([...descendantCategoryIds(cats, 'a')].sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('isScopeEmpty', () => {
  it('true only when no folders and no included events (excludes alone don’t count)', () => {
    expect(isScopeEmpty(EMPTY_SCOPE)).toBe(true)
    expect(isScopeEmpty(S({ excludeEvents: ['e'] }))).toBe(true)
    expect(isScopeEmpty(S({ folderIds: ['f'] }))).toBe(false)
    expect(isScopeEmpty(S({ includeEvents: ['e'] }))).toBe(false)
  })
})

describe('scopedCategoryIds', () => {
  it('unions each checked folder’s subtree', () => {
    const cats = [cat({ id: 'p' }), cat({ id: 'c', parentId: 'p' }), cat({ id: 'x' })]
    expect([...scopedCategoryIds(S({ folderIds: ['p'] }), cats)].sort()).toEqual(['c', 'p'])
  })
})

describe('isMember', () => {
  const cats = [cat({ id: 'p' }), cat({ id: 'c', parentId: 'p' })]
  it('event under a checked folder’s subtree is a member', () => {
    const e = ev({ id: 'e', categoryId: 'c' })
    expect(isMember(S({ folderIds: ['p'] }), e, cats)).toBe(true)
  })
  it('excluded event under a checked folder is NOT a member', () => {
    const e = ev({ id: 'e', categoryId: 'c' })
    expect(isMember(S({ folderIds: ['p'], excludeEvents: ['e'] }), e, cats)).toBe(false)
  })
  it('individually included event is a member even outside any checked folder', () => {
    const e = ev({ id: 'e', categoryId: null })
    expect(isMember(S({ includeEvents: ['e'] }), e, cats)).toBe(true)
  })
  it('tombstone is never a member', () => {
    const e = ev({ id: 'e', categoryId: 'c', deleted: true })
    expect(isMember(S({ folderIds: ['p'] }), e, cats)).toBe(false)
  })
})

describe('folderCheckStates', () => {
  const cats = [cat({ id: 'p' }), cat({ id: 'c', parentId: 'p' })]
  const events = [ev({ id: 'a', categoryId: 'p' }), ev({ id: 'b', categoryId: 'c' })]
  const statesOf = (scope: Scope) =>
    folderCheckStates(cats, events, memberEventIds(scope, cats, events), new Set(scope.folderIds))
  it('checked when all descendant events are members', () => {
    expect(statesOf(S({ folderIds: ['p'] })).get('p')).toBe('checked')
  })
  it('indeterminate when some but not all', () => {
    expect(statesOf(S({ folderIds: ['p'], excludeEvents: ['b'] })).get('p')).toBe('indeterminate')
  })
  it('unchecked when none', () => {
    expect(statesOf(EMPTY_SCOPE).get('p')).toBe('unchecked')
  })
  it('a child folder gets its own state, not its parent’s', () => {
    const states = statesOf(S({ folderIds: ['p'], excludeEvents: ['b'] }))
    expect(states.get('p')).toBe('indeterminate') // a in, b out
    expect(states.get('c')).toBe('unchecked') // only holds b, which is excluded
  })
  it('empty folder is checked iff explicitly (or ancestor) checked', () => {
    const empty = [cat({ id: 'q' }), cat({ id: 'q2', parentId: 'q' })]
    const on = folderCheckStates(empty, [], new Set(), new Set(['q']))
    expect(on.get('q')).toBe('checked')
    expect(on.get('q2')).toBe('checked') // inherits from the checked ancestor
    expect(folderCheckStates(empty, [], new Set(), new Set()).get('q')).toBe('unchecked')
  })
  it('covers every live folder in one call, and skips tombstoned ones', () => {
    const withDead = [...cats, cat({ id: 'gone', deleted: true })]
    const states = folderCheckStates(withDead, events, new Set(), new Set())
    expect([...states.keys()].sort()).toEqual(['c', 'p'])
  })
})

describe('toggleFolder', () => {
  const cats = [cat({ id: 'p' }), cat({ id: 'c', parentId: 'p' })]
  const events = [ev({ id: 'a', categoryId: 'p' }), ev({ id: 'b', categoryId: 'c' })]
  it('unchecked → checks the whole subtree', () => {
    expect(toggleFolder(EMPTY_SCOPE, 'p', cats, events).folderIds).toEqual(['p'])
  })
  it('checked → clears the whole subtree', () => {
    expect(toggleFolder(S({ folderIds: ['p'] }), 'p', cats, events)).toEqual(EMPTY_SCOPE)
  })
  it('indeterminate → fills to checked and clears the exclusion', () => {
    const out = toggleFolder(S({ folderIds: ['p'], excludeEvents: ['b'] }), 'p', cats, events)
    expect(out.folderIds).toEqual(['p'])
    expect(out.excludeEvents).toEqual([])
  })
  it('unchecking a child folder while the parent is checked excludes the child subtree', () => {
    const parentChecked = toggleFolder(EMPTY_SCOPE, 'p', cats, events) // { folderIds: ['p'] }
    const childUnchecked = toggleFolder(parentChecked, 'c', cats, events)
    const members = memberEventIds(childUnchecked, cats, events)
    expect(members.has('b')).toBe(false) // child's event is excluded
    expect(members.has('a')).toBe(true) // parent's own event stays
    const states = folderCheckStates(cats, events, members, new Set(childUnchecked.folderIds))
    expect(states.get('c')).toBe('unchecked')
    expect(states.get('p')).toBe('indeterminate')
  })
  it('re-checking the child folder restores its subtree', () => {
    const s = toggleFolder(toggleFolder(toggleFolder(EMPTY_SCOPE, 'p', cats, events), 'c', cats, events), 'c', cats, events)
    const members = memberEventIds(s, cats, events)
    expect(members.has('b')).toBe(true)
    expect(folderCheckStates(cats, events, members, new Set(s.folderIds)).get('c')).toBe('checked')
  })
})

describe('toggleEvent', () => {
  const cats = [cat({ id: 'p' })]
  const e = ev({ id: 'a', categoryId: 'p' })
  it('member via folder → adds to excludeEvents', () => {
    expect(toggleEvent(S({ folderIds: ['p'] }), e, cats).excludeEvents).toEqual(['a'])
  })
  it('non-member → adds to includeEvents', () => {
    expect(toggleEvent(EMPTY_SCOPE, e, cats).includeEvents).toEqual(['a'])
  })
  it('undo an individual include', () => {
    expect(toggleEvent(S({ includeEvents: ['a'] }), e, cats).includeEvents).toEqual([])
  })
})

describe('soloFolder', () => {
  it('replaces the scope with just that folder', () => {
    expect(soloFolder('f')).toEqual({ folderIds: ['f'], includeEvents: [], excludeEvents: [] })
  })
})
