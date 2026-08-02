import { useCallback, useEffect, useState } from 'react'

/**
 * Whether this device can add RallyHub to its home screen, and how.
 *
 * Two routes exist and browsers disagree on which they support. Chromium fires
 * `beforeinstallprompt`, which we hold on to so a button in our own UI can open
 * the native install dialog. Safari fires nothing at all and installing is a
 * manual trip through the Share menu or the File menu, so there the only honest
 * option is to show the steps.
 *
 * `method` is null when neither route exists, which is the signal to render no
 * button at all rather than one that cannot do anything.
 */

/** Chromium-only event, not in lib.dom. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type InstallMethod =
  /** Chromium: we hold a live prompt event and can open the real dialog. */
  | 'prompt'
  /** Installing is possible but only by hand, so show the instructions. */
  | 'guide'

/** Already running from the home screen, Dock or desktop. */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const displayModes = ['standalone', 'fullscreen', 'minimal-ui']
  if (displayModes.some((mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches)) {
    return true
  }
  // iOS predates display-mode and reports this instead.
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Platforms that can install without ever firing `beforeinstallprompt`. */
export type ManualPlatform = 'ios' | 'android' | 'macos-safari'

/**
 * iPadOS reports a Mac user agent, so touch points are what separates an iPad
 * from a desktop. Every Chromium browser puts "Safari" in its user agent too,
 * hence the exclusions.
 */
function detectManualPlatform(): ManualPlatform | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent

  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }

  // Firefox on Android installs from its own menu and fires no event.
  if (/Android/.test(ua)) return 'android'

  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua)
  return isSafari && /Macintosh/.test(ua) ? 'macos-safari' : null
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  // Chromium fires the event once. If the user dismisses the dialog it will not
  // fire again this session, so remember that installing is possible here and
  // fall back to the written steps rather than having the button vanish.
  const [sawPrompt, setSawPrompt] = useState(false)

  const [standalone] = useState(detectStandalone)
  const [platform] = useState(detectManualPlatform)

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      // Suppress Chromium's own mini-infobar so the only way in is our button.
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setSawPrompt(true)
    }

    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  /**
   * Opens the native dialog. Returns true if the user accepted, false if they
   * dismissed it or there was no prompt to open.
   */
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    // Single use, accepted or not.
    setDeferred(null)
    return outcome === 'accepted'
  }, [deferred])

  const hidden = standalone || installed
  const method: InstallMethod | null = hidden
    ? null
    : deferred
      ? 'prompt'
      : sawPrompt || platform
        ? 'guide'
        : null

  return {
    /** Running as an installed app already. */
    standalone,
    /** Installed during this visit. */
    installed,
    /** null means offer nothing. */
    method,
    /** Which manual route applies, for wording the steps. */
    platform,
    promptInstall,
  }
}
