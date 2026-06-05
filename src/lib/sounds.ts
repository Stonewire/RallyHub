// Real sound-file playback (replaces the old Web Audio tone generator).
// Files live in public/sounds/ and are served from /sounds/<name>.mp3.
//
// Latency: every sound keeps a preloaded pool of HTMLAudioElements. Playing
// resets currentTime and calls play() immediately on an already-loaded element,
// so there is no per-tap element-creation / network delay. When all pooled
// elements for a sound are still playing (rapid-fire taps), a clone is added so
// overlapping plays never wait.
//
// Autoplay: mobile browsers block programmatic play() until a sound element has
// been played once inside a user gesture. We prime (unlock) every pooled element
// on the first user interaction so later realtime-triggered sounds (announcement,
// chat message, win) actually play.

const SOUND_DIR = '/sounds'

/**
 * Balanced per-sound volumes (0..1). Short feedback/notification sounds are kept
 * gentle so nothing is jarring; celebratory moments are fuller but not blasting.
 */
const SOUND_VOLUME: Record<string, number> = {
  // Short feedback / notifications — subtle.
  shutter: 0.4,
  submit: 0.4,
  'new-submission': 0.45,
  'new-message': 0.4,
  announcement: 0.5,
  'quiz-select': 0.4,
  'quiz-correct': 0.45,
  'quiz-wrong': 0.45,
  'timer-warning': 0.45,
  'video-start': 0.45,
  'video-stop': 0.45,
  loser: 0.5,
  // Celebratory — fuller, but tuned so the combined mix is pleasant.
  winner: 0.7,
  celebration: 0.7,
  cheer: 0.5,
  fireworks: 0.5,
}

/**
 * Per-sound trims to make short clicks snappy: start a touch past any leading
 * silence and cap the effective playback so the sound is brief and punchy.
 */
const SOUND_TRIM: Record<string, { start: number; maxMs: number }> = {
  shutter: { start: 0.02, maxMs: 250 },
  'quiz-select': { start: 0.02, maxMs: 250 },
}

const ALL_SOUNDS = Object.keys(SOUND_VOLUME)
const DEFAULT_VOLUME = 0.5
const MAX_POOL_PER_SOUND = 8

function soundUrl(name: string): string {
  return `${SOUND_DIR}/${name}.mp3`
}

function clampVolume(v: number): number {
  if (Number.isNaN(v)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, v))
}

function createEl(name: string): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  try {
    const el = new Audio(soundUrl(name))
    el.preload = 'auto'
    el.load()
    return el
  } catch {
    return null
  }
}

// A pool of preloaded elements per sound so playback is instant and overlap-safe.
const pools = new Map<string, HTMLAudioElement[]>()
// Auto-stop timers for capped (trimmed) sounds, keyed by element.
const capTimers = new WeakMap<HTMLAudioElement, number>()

function preloadAll() {
  if (typeof Audio === 'undefined') return
  for (const name of ALL_SOUNDS) {
    const el = createEl(name)
    if (el) pools.set(name, [el])
  }
}

preloadAll()

// ---- Autoplay unlock -------------------------------------------------------

let soundsUnlocked = false

function primeElement(el: HTMLAudioElement) {
  try {
    el.muted = false
    const prevVolume = el.volume
    el.volume = 0
    const reset = () => {
      try {
        el.pause()
        el.currentTime = 0
      } catch {
        // ignore
      }
      el.volume = prevVolume
    }
    const p = el.play()
    if (p && typeof p.then === 'function') {
      p.then(reset).catch(reset)
    } else {
      reset()
    }
  } catch {
    // ignore — playback will simply remain locked for this element
  }
}

/**
 * Prime every pooled sound element so later programmatic play() calls are not
 * blocked by the browser autoplay policy. Safe to call multiple times (no-ops
 * after the first). Runs automatically on the first user gesture, but can also
 * be called explicitly from a "tap to enable sound" gate (e.g. the display
 * panel, which may never receive another tap during an event).
 */
export function unlockSounds() {
  if (soundsUnlocked || typeof window === 'undefined') return
  soundsUnlocked = true
  for (const pool of pools.values()) {
    const el = pool[0]
    if (el) primeElement(el)
  }
}

if (typeof window !== 'undefined') {
  const handler = () => unlockSounds()
  window.addEventListener('pointerdown', handler, { once: true, passive: true })
  window.addEventListener('touchend', handler, { once: true, passive: true })
  window.addEventListener('keydown', handler, { once: true })
}

// ---- Core playback ---------------------------------------------------------

/** Get a free (paused/ended) pooled element, cloning a fresh one if all are busy. */
function acquire(name: string): HTMLAudioElement | null {
  let pool = pools.get(name)
  if (!pool) {
    const el = createEl(name)
    if (!el) return null
    pool = [el]
    pools.set(name, pool)
  }
  let free = pool.find((a) => a.paused || a.ended)
  if (!free) {
    const clone = createEl(name)
    if (clone) {
      pool.push(clone)
      if (pool.length > MAX_POOL_PER_SOUND) pool.splice(0, pool.length - MAX_POOL_PER_SOUND)
      free = clone
    } else {
      free = pool[0]
    }
  }
  return free ?? null
}

/**
 * Play a sound file by name from /sounds/ using a preloaded pooled element.
 * Returns the audio element (so callers can chain/stop), or null if unavailable.
 * Never throws — autoplay rejections and load failures are logged, not fatal.
 */
export function playSound(name: string, volume?: number): HTMLAudioElement | null {
  const el = acquire(name)
  if (!el) return null
  el.volume = clampVolume(volume ?? SOUND_VOLUME[name] ?? DEFAULT_VOLUME)

  const trim = SOUND_TRIM[name]
  try {
    el.currentTime = trim?.start ?? 0
  } catch {
    // Seeking before metadata is loaded can throw on some browsers — ignore.
  }

  const prevCap = capTimers.get(el)
  if (prevCap) {
    window.clearTimeout(prevCap)
    capTimers.delete(el)
  }

  try {
    const result = el.play()
    if (result && typeof result.then === 'function') {
      result.catch((err) => {
        console.warn(`[sounds] could not play "${name}.mp3"`, err)
      })
    }
  } catch (err) {
    console.warn(`[sounds] failed to play "${name}.mp3"`, err)
  }

  if (trim) {
    const id = window.setTimeout(() => {
      try {
        el.pause()
      } catch {
        // ignore
      }
      capTimers.delete(el)
    }, trim.maxMs)
    capTimers.set(el, id)
  }

  return el
}

export function playShutterSound() {
  return playSound('shutter')
}

export function playSubmitSound() {
  return playSound('submit')
}

export function playNewSubmissionSound() {
  return playSound('new-submission')
}

export function playNewMessageSound() {
  return playSound('new-message')
}

/** Reuses the new-submission sound for generic push toasts. */
export function playPushNotificationSound() {
  return playSound('new-submission')
}

export function playAnnouncementSound() {
  return playSound('announcement')
}

export function playQuizSelectSound() {
  return playSound('quiz-select')
}

export function playQuizCorrectSound() {
  return playSound('quiz-correct')
}

export function playQuizWrongSound() {
  return playSound('quiz-wrong')
}

export function playQuizTimerWarningSound() {
  return playSound('timer-warning')
}

export function playVideoStartSound() {
  return playSound('video-start')
}

export function playVideoStopSound() {
  return playSound('video-stop')
}

export function playWinnerSound() {
  return playSound('winner')
}

export function playLoserSound() {
  return playSound('loser')
}

export function playCheerSound() {
  return playSound('cheer')
}

export function playFireworksSound() {
  return playSound('fireworks')
}

export function playCelebrationSound() {
  return playSound('celebration')
}

// ---- Bingo win sequence ----------------------------------------------------

// Track the active bingo celebration sequence so a new win stops the previous
// one instead of stacking multiple songs on top of each other.
let activeWinSequenceStop: (() => void) | null = null

const WIN_CROSSFADE_SEC = 5

/**
 * Bingo win audio sequence for the winning side (display panel + winner phone):
 * winner.mp3 + cheer.mp3 start together immediately. Over winner.mp3's final 5
 * seconds it crossfades into celebration.mp3 (the long song) via volume ramping,
 * which then continues at full volume. On the display panel, fireworks.mp3 also
 * layers in. Returns a stop() that halts the whole sequence.
 *
 * Uses the preloaded (and gesture-unlocked) pooled elements so playback is not
 * blocked by autoplay policy. Fully self-contained — does NOT touch the bingo
 * track crossfade.
 */
export function playBingoWinSequence(isDisplay: boolean): () => void {
  // Stop any previous celebration before starting a new one (frees its element).
  activeWinSequenceStop?.()

  if (typeof Audio === 'undefined') {
    return () => {}
  }

  const winnerVol = clampVolume(SOUND_VOLUME.winner ?? 0.7)
  const celebVol = clampVolume(SOUND_VOLUME.celebration ?? 0.7)

  const winner = acquire('winner') ?? createEl('winner')
  const celebration = acquire('celebration') ?? createEl('celebration')
  if (!winner || !celebration) {
    // Fallback: at least play the fanfare via the normal path.
    playWinnerSound()
    return () => {}
  }

  winner.volume = winnerVol
  celebration.volume = 0
  try {
    winner.currentTime = 0
  } catch {
    // ignore
  }

  // Crowd cheer plays together with the fanfare on BOTH the display and the
  // winning phone. Fireworks only on the display.
  playSound('cheer')
  if (isDisplay) playSound('fireworks')

  let fadeTimer: number | undefined
  let safetyTimer: number | undefined
  let crossfading = false
  let celebrationStarted = false

  const startCelebration = (atFullVolume: boolean) => {
    if (celebrationStarted) return
    celebrationStarted = true
    if (atFullVolume) celebration.volume = celebVol
    try {
      celebration.currentTime = 0
    } catch {
      // ignore
    }
    const p = celebration.play()
    if (p && typeof p.then === 'function') {
      p.catch((err) => console.warn('[sounds] could not play "celebration.mp3"', err))
    }
  }

  const beginCrossfade = () => {
    if (crossfading) return
    crossfading = true
    startCelebration(false)
    const steps = 50
    const stepMs = (WIN_CROSSFADE_SEC * 1000) / steps
    let i = 0
    fadeTimer = window.setInterval(() => {
      i += 1
      const t = Math.min(1, i / steps)
      winner.volume = clampVolume(winnerVol * (1 - t))
      celebration.volume = clampVolume(celebVol * t)
      if (t >= 1) {
        if (fadeTimer) window.clearInterval(fadeTimer)
        fadeTimer = undefined
        try {
          winner.pause()
        } catch {
          // ignore
        }
        celebration.volume = celebVol
      }
    }, stepMs)
  }

  const onTime = () => {
    const dur = winner.duration
    if (!dur || Number.isNaN(dur) || !Number.isFinite(dur)) return
    if (dur - winner.currentTime <= WIN_CROSSFADE_SEC) beginCrossfade()
  }
  winner.addEventListener('timeupdate', onTime)

  // Fallback 1: if the crossfade window never triggers, start celebration when
  // winner.mp3 ends, at full volume.
  winner.addEventListener(
    'ended',
    () => {
      if (!celebrationStarted) startCelebration(true)
    },
    { once: true },
  )

  const wp = winner.play()
  if (wp && typeof wp.then === 'function') {
    wp.catch((err) => {
      console.warn('[sounds] could not play "winner.mp3"', err)
      // Fallback 2: if the fanfare is blocked, go straight to the celebration.
      startCelebration(true)
    })
  }

  // Fallback 3: hard safety — if nothing started the song within 20s, start it.
  safetyTimer = window.setTimeout(() => {
    if (!celebrationStarted) startCelebration(true)
  }, 20_000)

  const stop = () => {
    if (fadeTimer) window.clearInterval(fadeTimer)
    if (safetyTimer) window.clearTimeout(safetyTimer)
    fadeTimer = undefined
    safetyTimer = undefined
    winner.removeEventListener('timeupdate', onTime)
    try {
      winner.pause()
    } catch {
      // ignore
    }
    try {
      celebration.pause()
    } catch {
      // ignore
    }
    if (activeWinSequenceStop === stop) activeWinSequenceStop = null
  }

  activeWinSequenceStop = stop
  return stop
}
