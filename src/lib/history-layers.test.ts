import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  armExitGuard,
  handleBackPress,
  historyLayerDepth,
  pushHistoryLayer,
  removeHistoryLayer,
  resetHistoryLayers,
} from './history-layers'

/** A back press that landed somewhere other than the floor guard entry. */
function back() {
  return handleBackPress(false)
}

beforeEach(() => {
  resetHistoryLayers()
})

describe('history layer stack', () => {
  it('closes the top layer on a device back press', () => {
    const closeGame = vi.fn()
    pushHistoryLayer(closeGame)

    expect(back()).toBe('closed-layer')
    expect(closeGame).toHaveBeenCalledTimes(1)
    expect(historyLayerDepth()).toBe(0)
  })

  it('unwinds layer by layer, newest first', () => {
    const closeGame = vi.fn()
    const closeSheet = vi.fn()
    pushHistoryLayer(closeGame)
    pushHistoryLayer(closeSheet)

    back()
    expect(closeSheet).toHaveBeenCalledTimes(1)
    expect(closeGame).not.toHaveBeenCalled()

    back()
    expect(closeGame).toHaveBeenCalledTimes(1)
  })

  it('asks the top layer to drop its history entry when closed in app', () => {
    const id = pushHistoryLayer(vi.fn())
    expect(removeHistoryLayer(id)).toBe(true)
    expect(historyLayerDepth()).toBe(0)
  })

  it('swallows the popstate its own history.back() causes, closing nothing twice', () => {
    const closeUnderneath = vi.fn()
    const closeTop = vi.fn()
    pushHistoryLayer(closeUnderneath)
    const topId = pushHistoryLayer(closeTop)

    // In-app close: the component already closed itself, so this must not
    // close the layer underneath when the resulting popstate arrives.
    removeHistoryLayer(topId)
    expect(back()).toBe('closed-layer')
    expect(closeUnderneath).not.toHaveBeenCalled()
    expect(closeTop).not.toHaveBeenCalled()
    expect(historyLayerDepth()).toBe(1)
  })

  it('drops an out-of-order close without touching history', () => {
    const bottomId = pushHistoryLayer(vi.fn())
    const closeTop = vi.fn()
    pushHistoryLayer(closeTop)

    // A layer underneath closing first (a state change closed it, not a tap):
    // its entry stays until the next pop absorbs it.
    expect(removeHistoryLayer(bottomId)).toBe(false)
    expect(historyLayerDepth()).toBe(1)

    back()
    expect(closeTop).toHaveBeenCalledTimes(1)
  })

  it('ignores an unknown id', () => {
    expect(removeHistoryLayer(999)).toBe(false)
  })
})

describe('floor guard', () => {
  it('spends the guard once, then lets the next press leave', () => {
    armExitGuard()

    expect(back()).toBe('warn')
    expect(back()).toBe('leave')
  })

  it('leaves the guard alone until every layer is closed', () => {
    armExitGuard()
    const closeGame = vi.fn()
    const closeCamera = vi.fn()
    pushHistoryLayer(closeGame)
    pushHistoryLayer(closeCamera)

    expect(back()).toBe('closed-layer')
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(back()).toBe('closed-layer')
    expect(closeGame).toHaveBeenCalledTimes(1)
    expect(back()).toBe('warn')
    expect(back()).toBe('leave')
  })

  it('terminates: pressing back over and over reaches leave and stays there', () => {
    armExitGuard()
    pushHistoryLayer(vi.fn())
    pushHistoryLayer(vi.fn())

    const outcomes = Array.from({ length: 6 }, () => back())
    expect(outcomes).toEqual([
      'closed-layer',
      'closed-layer',
      'warn',
      'leave',
      'leave',
      'leave',
    ])
  })

  it('does not spend the guard on a spare entry left above it', () => {
    armExitGuard()

    // The browser came to rest on the guard entry itself, so what just went
    // was an orphan from an out-of-order close, not the guard.
    expect(handleBackPress(true)).toBe('stay')
    expect(back()).toBe('warn')
    expect(back()).toBe('leave')
  })

  it('never leaves while the page has not armed a guard at all', () => {
    // A surface with no guard (nothing pushed on mount) still unwinds its
    // layers first and only then reports the navigation as the browser's.
    const closeSheet = vi.fn()
    pushHistoryLayer(closeSheet)

    expect(back()).toBe('closed-layer')
    expect(back()).toBe('leave')
  })
})

describe('floor guard arming', () => {
  it('arms once, so a remount cannot stack a second guard', () => {
    resetHistoryLayers()
    expect(armExitGuard()).toBe(true)
    expect(armExitGuard()).toBe(false)
    expect(armExitGuard()).toBe(false)
  })

  it('does not re-arm after the guard has been spent', () => {
    resetHistoryLayers()
    armExitGuard()
    expect(handleBackPress(false)).toBe('warn')
    // A remount here must not put the guard back, or back would trap again.
    expect(armExitGuard()).toBe(false)
    expect(handleBackPress(false)).toBe('leave')
  })
})

