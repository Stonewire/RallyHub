import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  historyLayerDepth,
  popHistoryLayer,
  pushHistoryLayer,
  removeHistoryLayer,
  resetHistoryLayers,
} from './history-layers'

beforeEach(() => {
  resetHistoryLayers()
})

describe('history layer stack', () => {
  it('closes the top layer on a device back press', () => {
    const closeGame = vi.fn()
    pushHistoryLayer(closeGame)

    expect(popHistoryLayer()).toBe(true)
    expect(closeGame).toHaveBeenCalledTimes(1)
    expect(historyLayerDepth()).toBe(0)
  })

  it('unwinds layer by layer, newest first', () => {
    const closeGame = vi.fn()
    const closeSheet = vi.fn()
    pushHistoryLayer(closeGame)
    pushHistoryLayer(closeSheet)

    popHistoryLayer()
    expect(closeSheet).toHaveBeenCalledTimes(1)
    expect(closeGame).not.toHaveBeenCalled()

    popHistoryLayer()
    expect(closeGame).toHaveBeenCalledTimes(1)
  })

  it('lets the page navigate away once nothing is open', () => {
    expect(popHistoryLayer()).toBe(false)
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
    expect(popHistoryLayer()).toBe(true)
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

    popHistoryLayer()
    expect(closeTop).toHaveBeenCalledTimes(1)
  })

  it('ignores an unknown id', () => {
    expect(removeHistoryLayer(999)).toBe(false)
  })
})
