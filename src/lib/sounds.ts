// Real sound-file playback (replaces the old Web Audio tone generator).
// Files live in public/sounds/ and are served from /sounds/<name>.mp3.

const SOUND_DIR = '/sounds'

/** Sensible per-sound volumes (0..1). UI blips are quieter than celebrations. */
const SOUND_VOLUME: Record<string, number> = {
  shutter: 0.5,
  submit: 0.5,
  'new-submission': 0.5,
  'new-message': 0.4,
  announcement: 0.6,
  'quiz-select': 0.4,
  'quiz-correct': 0.55,
  'quiz-wrong': 0.5,
  'timer-warning': 0.5,
  'video-start': 0.5,
  'video-stop': 0.5,
  winner: 0.8,
  loser: 0.6,
  cheer: 0.6,
  fireworks: 0.6,
  celebration: 0.7,
}

const ALL_SOUNDS = Object.keys(SOUND_VOLUME)

const DEFAULT_VOLUME = 0.5

function soundUrl(name: string): string {
  return `${SOUND_DIR}/${name}.mp3`
}

function clampVolume(v: number): number {
  if (Number.isNaN(v)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, v))
}

// Keep one preloaded element per sound to warm the browser/HTTP cache so the
// first real play has low latency.
const preloaded = new Map<string, HTMLAudioElement>()

function preloadAll() {
  if (typeof Audio === 'undefined') return
  for (const name of ALL_SOUNDS) {
    try {
      const el = new Audio(soundUrl(name))
      el.preload = 'auto'
      el.load()
      preloaded.set(name, el)
    } catch {
      // Ignore preload failures; playback will retry on demand.
    }
  }
}

preloadAll()

/**
 * Play a sound file by name from /sounds/. Returns the audio element (so callers
 * can chain on 'ended' or stop it), or null if audio is unavailable.
 * Never throws and never blocks — autoplay rejections are logged, not fatal.
 */
export function playSound(name: string, volume?: number): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  try {
    // A fresh element per call allows overlapping playback (e.g. winner + cheer).
    const el = new Audio(soundUrl(name))
    el.volume = clampVolume(volume ?? SOUND_VOLUME[name] ?? DEFAULT_VOLUME)
    const result = el.play()
    if (result && typeof result.then === 'function') {
      result.catch((err) => {
        console.warn(`[sounds] could not play "${name}.mp3"`, err)
      })
    }
    return el
  } catch (err) {
    console.warn(`[sounds] failed to create audio for "${name}.mp3"`, err)
    return null
  }
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

/**
 * Bingo win audio sequence for the winning side (display panel + winner phone):
 * winner.mp3 immediately, then celebration.mp3 once winner.mp3 ends (or ~3s).
 * On the display panel, also layer cheer.mp3 + fireworks.mp3 at the start.
 * Returns a stop() that halts the sequence.
 */
export function playBingoWinSequence(isDisplay: boolean): () => void {
  // Stop any previous celebration before starting a new one.
  activeWinSequenceStop?.()

  const winner = playWinnerSound()
  if (isDisplay) {
    playCheerSound()
    playFireworksSound()
  }

  let celebration: HTMLAudioElement | null = null
  let started = false
  const startCelebration = () => {
    if (started) return
    started = true
    celebration = playCelebrationSound()
  }

  // Start the long song when the fanfare ends, or after ~3s as a fallback.
  const fallback = window.setTimeout(startCelebration, 3000)
  winner?.addEventListener('ended', startCelebration, { once: true })

  const stop = () => {
    window.clearTimeout(fallback)
    try {
      winner?.pause()
    } catch {
      // ignore
    }
    try {
      celebration?.pause()
    } catch {
      // ignore
    }
    if (activeWinSequenceStop === stop) activeWinSequenceStop = null
  }

  activeWinSequenceStop = stop
  return stop
}
