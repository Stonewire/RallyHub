import { useEffect, useRef } from 'react'

import {
  popHistoryLayer,
  pushHistoryLayer,
  removeHistoryLayer,
} from '@/lib/history-layers'

/**
 * Makes the device back button and back swipe close one open layer.
 *
 * Pass whether the layer is open and how to close it: while it is open the hook
 * holds one history entry, so back closes it instead of leaving the join link.
 * Closing from inside the app (our own back button, finishing a game) drops
 * that entry again, so the two routes never disagree about the depth.
 *
 * The pushed entry keeps the same URL, so react-router never sees a location
 * change and the surface does not re-render or re-mount.
 */
export function useBackLayer(open: boolean, close: () => void) {
  // The close callback is usually an inline arrow, so it is read through a ref:
  // re-registering the layer on every render would push a history entry per
  // render.
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  useEffect(() => {
    if (!open) return
    const id = pushHistoryLayer(() => closeRef.current())
    window.history.pushState({ rallyhubLayer: id }, '')

    return () => {
      // Only the top layer can drop its own entry; anything else is absorbed
      // by the next pop (see removeHistoryLayer).
      if (removeHistoryLayer(id)) window.history.back()
    }
  }, [open])
}

/**
 * Installs the single popstate listener the layers share. Mount once on the
 * player surface, above every layer.
 */
export function useBackLayerHost() {
  useEffect(() => {
    function onPopState() {
      // Nothing of ours open: let the browser navigation stand, which is the
      // player leaving the event as they intended.
      popHistoryLayer()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
}
