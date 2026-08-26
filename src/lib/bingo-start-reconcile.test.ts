import { describe, expect, it } from 'vitest'

import { reconcileBingoPlayOrder } from '@/lib/bingo-start-reconcile'

describe('reconcileBingoPlayOrder', () => {
  it('swaps the played track into the pressed index', () => {
    expect(reconcileBingoPlayOrder(['b', 'c', 'a', 'd'], 0, 'a')).toEqual([
      'a',
      'c',
      'b',
      'd',
    ])
  })

  it('swaps within the unplayed tail at a non-zero index', () => {
    expect(reconcileBingoPlayOrder(['a', 'b', 'c', 'd'], 1, 'd')).toEqual([
      'a',
      'd',
      'c',
      'b',
    ])
  })

  it('returns null when the played track already sits at the pressed index', () => {
    expect(reconcileBingoPlayOrder(['a', 'b', 'c'], 0, 'a')).toBeNull()
  })

  it('returns null when the played track is not in the order', () => {
    expect(reconcileBingoPlayOrder(['a', 'b', 'c'], 0, 'zzz')).toBeNull()
  })

  it('never rewrites an already played position', () => {
    // 'a' sits before the pressed index, so it was played or revealed in an
    // earlier round and must stay where it is.
    expect(reconcileBingoPlayOrder(['a', 'b', 'c'], 2, 'a')).toBeNull()
  })

  it('returns null for an out-of-range index', () => {
    expect(reconcileBingoPlayOrder(['a', 'b'], 2, 'a')).toBeNull()
    expect(reconcileBingoPlayOrder(['a', 'b'], -1, 'a')).toBeNull()
  })

  it('returns null for a malformed or empty order', () => {
    expect(reconcileBingoPlayOrder(null, 0, 'a')).toBeNull()
    expect(reconcileBingoPlayOrder('not-an-array', 0, 'a')).toBeNull()
    expect(reconcileBingoPlayOrder([], 0, 'a')).toBeNull()
  })

  it('returns null for an empty played track id', () => {
    expect(reconcileBingoPlayOrder(['a', 'b'], 0, '')).toBeNull()
  })

  it('does not mutate the input order', () => {
    const order = ['b', 'a', 'c']
    reconcileBingoPlayOrder(order, 0, 'a')
    expect(order).toEqual(['b', 'a', 'c'])
  })
})
