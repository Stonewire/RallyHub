/**
 * R2.8: the device back button and the back swipe close what is open in the
 * app before they leave the site.
 *
 * Players reach for the phone's own back gesture, not our in-app back button,
 * so on the player surface every openable layer (a game, the camera, the store
 * sheet, the chat drawer, a dialog) pushes one history entry while it is open.
 * Back pops that entry and closes the top layer instead of walking off the
 * join link; only once every layer is closed does back leave the page.
 *
 * The stack below is the bookkeeping that makes the two directions agree:
 * closing from inside the app calls history.back(), which fires the same
 * popstate a device gesture would, so the entry we pushed always goes away
 * exactly once.
 *
 * Underneath the stack sits the floor guard: one extra entry the join page
 * holds so the very first press cannot fall out of a live event by accident.
 * It is spent once and never re-pushed, so pressing back over and over always
 * reaches the browser's own back behaviour instead of looping inside us.
 */

export type LayerEntry = {
  id: number
  /** Closes this layer. Called when the browser pops its entry. */
  close: () => void
}

/** What the page must do with one device back press. */
export type BackPressOutcome =
  /** A layer took the press and closed itself. Nothing else to do. */
  | 'closed-layer'
  /** Nothing of ours was open, but the floor guard is still standing. */
  | 'stay'
  /** The floor guard just went: warn that one more press leaves. */
  | 'warn'
  /** The guard is spent, so the browser navigation stands and we leave. */
  | 'leave'

let nextId = 1
const stack: LayerEntry[] = []
/** Entries we popped ourselves, whose popstate must not close anything else. */
let selfPops = 0
/** True while the join page's floor guard entry is still in history. */
let exitGuardArmed = false
/**
 * Whether the guard was ever put into history this page load.
 *
 * The join page's effect can run more than once (React StrictMode does it on
 * purpose in development, and any remount would too), and the pushed entry has
 * no cleanup because history is a stack. Pushing a second guard would put back
 * exactly the trap this replaced: every extra guard swallows one more back
 * press. Spending the guard does not clear this, so a remount after the player
 * has already been warned does not re-arm it either.
 */
let exitGuardEverArmed = false
/**
 * Depth stamped on each entry we push, for debugging a back stack in the wild.
 *
 * It is deliberately NOT used to tell a back press from a forward one. That
 * was tried: react-router rewrites history state on its own entries, so the
 * numbers stop being a reliable ordering and a real back press got read as a
 * forward one and did nothing. A forward swipe spending the guard early costs
 * one stray warning; a back press that does nothing is the bug this whole
 * change exists to remove.
 */
let position = 0

/** Test seam: the stack is module state, so tests start from a clean one. */
export function resetHistoryLayers() {
  stack.length = 0
  selfPops = 0
  nextId = 1
  exitGuardArmed = false
  exitGuardEverArmed = false
  position = 0
}

/** The depth to stamp on the next entry pushed into history. */
export function nextHistoryPosition() {
  position += 1
  return position
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
 * pop, which is why handleBackPress tolerates an empty or mismatched stack.
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
 * Arms the floor guard. Returns true only the first time, which is the caller's
 * signal to actually push the history entry; a repeat call is a remount and
 * must not add a second entry.
 */
export function armExitGuard(): boolean {
  if (exitGuardEverArmed) return false
  exitGuardEverArmed = true
  exitGuardArmed = true
  return true
}

/**
 * Resolves one device back press.
 *
 * `landedOnGuardEntry` is whether the browser came to rest on the guard entry
 * itself. An out-of-order close leaves a spare entry above the guard (see
 * removeHistoryLayer); popping that spare must not spend a guard the player
 * has not actually reached yet.
 */
export function handleBackPress(landedOnGuardEntry: boolean): BackPressOutcome {
  if (selfPops > 0) {
    // Our own history.back() from removeHistoryLayer: the layer is already
    // closed and its entry is now gone. Nothing else to do.
    selfPops -= 1
    return 'closed-layer'
  }
  const top = stack.pop()
  if (top) {
    top.close()
    return 'closed-layer'
  }
  if (landedOnGuardEntry) return 'stay'
  if (exitGuardArmed) {
    // The player is back where they opened the link. The guard is not
    // re-pushed: the next press is the browser's to handle, which is the whole
    // point of walking the app's own layers first.
    exitGuardArmed = false
    return 'warn'
  }
  return 'leave'
}
