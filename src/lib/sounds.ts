// Real sound-file playback (replaces the old Web Audio tone generator).
// Files live in public/sounds/ and are served from /sounds/<name>.mp3.
//
// Latency: every sound keeps a preloaded pool of HTMLAudioElements. Playing
// resets currentTime to 0 and calls play() immediately on an already-loaded
// element, so there is no per-tap element-creation / network delay. When all
// pooled elements for a sound are still playing (rapid-fire taps), a clone is
// added so overlapping plays never wait.

const SOUND_DIR = '/sounds'

/**
 * Balanced per-sound volumes (0..1). Short feedback/notification sounds are kept
 * gentle (~0.4–0.5) so nothing is jarring; celebratory moments stay fuller.
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
  // Celebratory — fuller.
  winner: 0.9,
  celebration: 0.85,
  cheer: 0.8,
  fireworks: 0.8,
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

function preloadAll() {
  if (typeof Audio === 'undefined') return
  for (const name of ALL_SOUNDS) {
    const el = createEl(name)
    if (el) pools.set(name, [el])
  }
}

preloadAll()

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
  try {
    el.currentTime = 0
  } catch {
    // Seeking before metadata is loaded can throw on some browsers — ignore.
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

// Track the active bingo celebration sequence so a new win stops the previous
// one instead of stacking multiple songs on top of each other.
let activeWinSequenceStop: (() => void) | null = null

const WIN_CROSSFADE_SEC = 5

/**
 * Bingo win audio sequence for the winning side (display panel + winner phone):
 * winner.mp3 (~17s) plays, then over its final 5 seconds it crossfades into
 * celebration.mp3 (the long song) via volume ramping, which then continues at
 * full volume. On the display panel, cheer.mp3 + fireworks.mp3 also layer at the
 * start for atmosphere. Returns a stop() that halts the whole sequence.
 *
 * This is fully self-contained and does NOT touch the bingo track crossfade.
 */
export function playBingoWinSequence(isDisplay: boolean): () => void {
  // Stop any previous celebration before starting a new one.
  activeWinSequenceStop?.()

  if (typeof Audio === 'undefined') {
    return () => {}
  }

  const winnerVol = clampVolume(SOUND_VOLUME.winner ?? 0.9)
  const celebVol = clampVolume(SOUND_VOLUME.celebration ?? 0.85)

  const winner = createEl('winner') ?? new Audio(soundUrl('winner'))
  winner.volume = winnerVol
  const celebration = createEl('celebration') ?? new Audio(soundUrl('celebration'))
  celebration.volume = 0

  if (isDisplay) {
    playSound('cheer')
    playSound('fireworks')
  }

  let fadeTimer: number | undefined
  let crossfading = false
  let celebrationStarted = false

  const startCelebration = () => {
    if (celebrationStarted) return
    celebrationStarted = true
    try {
      celebration.currentTime = 0
    } catch {
      // ignore seek errors
    }
    const p = celebration.play()
    if (p && typeof p.then === 'function') {
      p.catch((err) => console.warn('[sounds] could not play "celebration.mp3"', err))
    }
  }

  const beginCrossfade = () => {
    if (crossfading) return
    crossfading = true
    startCelebration()
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

  // Safety: if winner.mp3 ends without a crossfade (e.g. duration unknown or
  // shorter than the fade window), start the celebration song at full volume.
  winner.addEventListener(
    'ended',
    () => {
      if (!celebrationStarted) {
        celebration.volume = celebVol
        startCelebration()
      }
    },
    { once: true },
  )

  const wp = winner.play()
  if (wp && typeof wp.then === 'function') {
    wp.catch((err) => console.warn('[sounds] could not play "winner.mp3"', err))
  }

  const stop = () => {
    if (fadeTimer) window.clearInterval(fadeTimer)
    fadeTimer = undefined
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
