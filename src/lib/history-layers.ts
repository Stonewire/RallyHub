/**
 * R2.8: the device back button and the back swipe close what is open in the
 * app before they leave the site.
 *
 * Players reach for the phone's own back gesture, not our in-app back button,
 * so on the player surface every openable layer (a game, the store sheet, the
 * chat drawer, a dialog) pushes one history entry while it is open. Back pops
 * that entry and closes the top layer instead of walking off the join link;
 * only once every layer is closed does back leave the page.
 *
 * The stack below is the bookkeeping that makes the two directions agree:
 * closing from inside the app calls history.back(), which fires the same
 * popstate a device gesture would, so the entry we pushed always goes away
 * exactly once.
 */

export type LayerEntry = {
  id: number
  /** Closes this layer. Called when the browser pops its entry. */
  close: () => void
}

let nextId = 1
const stack: LayerEntry[] = []
/** Entries we popped ourselves, whose popstate must not close anything else. */
let selfPops = 0

/** Test seam: the stack is module state, so tests start from a clean one. */
export function resetHistoryLayers() {
  stack.length = 0
  selfPops = 0
  nextId = 1
}

export function historyLayerDepth() {
  return stack.length
}

/** Registers an opened layer and returns its id. */
export function pushHistoryLayer(close: () => void): number {
  const id = nextId++
  stack.push({ id, close })
  return id
}

/**
 * Removes a layer that closed from inside the app.
 *
 * Returns true when the caller should call history.back() to drop the entry it
 * pushed: only the top layer may, because history is a stack and popping a
 * middle entry is not a thing browsers offer. A layer closed out of order is
 * simply dropped from our bookkeeping and its entry is absorbed by the next
 * pop, which is why popHistoryLayer tolerates an empty or mismatched stack.
 */
export function removeHistoryLayer(id: number): boolean {
  const index = stack.findIndex((entry) => entry.id === id)
  if (index === -1) return false
  const isTop = index === stack.length - 1
  stack.splice(index, 1)
  if (isTop) {
    selfPops += 1
    return true
  }
  return false
}

/**
 * Handles a popstate. Closes the top layer and reports whether it handled the
 * event; false means nothing of ours was open, so the browser navigation
 * stands and the player leaves the page as they expect.
 */
export function popHistoryLayer(): boolean {
  if (selfPops > 0) {
    // Our own history.back() from removeHistoryLayer: the layer is already
    // closed and its entry is now gone. Nothing else to do.
    selfPops -= 1
    return true
  }
  const top = stack.pop()
  if (!top) return false
  top.close()
  return true
}
