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

let operationalSoundsUnlocked = false
let celebrationSoundsUnlocked = false
const primedElements = new WeakSet<HTMLAudioElement>()

const CELEBRATION_SOUND_NAMES = new Set([
  'winner',
  'celebration',
  'cheer',
  'fireworks',
  'loser',
])
const OPERATIONAL_SOUND_NAMES = ALL_SOUNDS.filter((s) => !CELEBRATION_SOUND_NAMES.has(s))

function primeElement(el: HTMLAudioElement) {
  if (primedElements.has(el)) return
  try {
    const prevVolume = el.volume
    const prevMuted = el.muted
    // Must be fully silent during the brief unlock play — volume 0 alone is not
    // enough on every browser.
    el.volume = 0
    el.muted = true
    const reset = () => {
      try {
        el.pause()
        el.currentTime = 0
      } catch {
        // ignore
      }
      el.muted = prevMuted
      el.volume = prevVolume
      primedElements.add(el)
    }
    const p = el.play()
    // Pause on the next tick so play() has started (unlock) but nothing is heard.
    window.setTimeout(reset, 0)
    if (p && typeof p.then === 'function') {
      p.then(reset).catch(reset)
    }
  } catch {
    // ignore — playback will simply remain locked for this element
  }
}

function primePoolSoundNames(names: readonly string[]) {
  if (typeof window === 'undefined') return
  for (const name of names) {
    const pool = pools.get(name)
    if (!pool) continue
    for (const el of pool) primeElement(el)
  }
}

/**
 * Prime short UI / notification sounds only. Used on the facilitator panel so
 * celebration audio is never unlocked or played there.
 */
export function unlockOperationalSounds() {
  if (operationalSoundsUnlocked || typeof window === 'undefined') return
  operationalSoundsUnlocked = true
  primePoolSoundNames(OPERATIONAL_SOUND_NAMES)
}

/**
 * Prime every pooled sound element (operational + celebration) so later
 * programmatic play() calls are not blocked. Safe to call multiple times.
 * Display panel and team devices call this; facilitator should not.
 */
export function unlockSounds() {
  unlockOperationalSounds()
  if (celebrationSoundsUnlocked || typeof window === 'undefined') return
  celebrationSoundsUnlocked = true
  primePoolSoundNames([...CELEBRATION_SOUND_NAMES])
}

function ensureElementPrimed(el: HTMLAudioElement) {
  if (primedElements.has(el)) return
  primeElement(el)
}

if (typeof window !== 'undefined') {
  // Default gesture unlock covers operational sounds only (facilitator-safe).
  const handler = () => unlockOperationalSounds()
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
  ensureElementPrimed(el)
  el.muted = false
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
  unlockSounds()
  return playSound('loser')
}

export function playCheerSound() {
  return playSound('cheer')
}

export function playFireworksSound() {
  return playSound('fireworks')
}

const WIN_CROSSFADE_SEC = 5

/** Last N seconds of fireworks.mp3 — used only in the event-winner celebration. */
const CELEBRATION_FIREWORKS_TAIL_SEC = 20

function logWinAudio(message: string, detail?: Record<string, unknown>) {
  if (detail) {
    console.log('[win-audio]', message, detail)
  } else {
    console.log('[win-audio]', message)
  }
}

function winAudioElementState(el: HTMLAudioElement, label: string) {
  return {
    label,
    src: el.currentSrc || el.src,
    readyState: el.readyState,
    volume: el.volume,
    muted: el.muted,
    paused: el.paused,
    duration: el.duration,
    currentTime: el.currentTime,
    primed: primedElements.has(el),
    inPool: pools.get(label)?.includes(el) ?? false,
  }
}

/**
 * Play the finale of fireworks.mp3 (last 20 seconds) for the event-winner
 * celebration on the display. If the file is shorter than 20 seconds, plays from
 * the start. Not used for bingo wins.
 */
export function playCelebrationFireworksSound(): HTMLAudioElement | null {
  unlockSounds()
  const el = acquire('fireworks')
  if (!el) return null
  ensureElementPrimed(el)
  el.muted = false
  el.volume = clampVolume(SOUND_VOLUME.fireworks ?? 0.5)

  const startPlayback = () => {
    const dur = el.duration
    if (dur && Number.isFinite(dur) && dur > CELEBRATION_FIREWORKS_TAIL_SEC) {
      try {
        el.currentTime = dur - CELEBRATION_FIREWORKS_TAIL_SEC
      } catch {
        // ignore
      }
      logWinAudio('celebration fireworks — starting from tail', {
        duration: dur,
        startAt: el.currentTime,
        tailSec: CELEBRATION_FIREWORKS_TAIL_SEC,
      })
    } else {
      try {
        el.currentTime = 0
      } catch {
        // ignore
      }
      logWinAudio('celebration fireworks — starting from beginning', {
        duration: dur,
      })
    }
    try {
      const p = el.play()
      if (p && typeof p.then === 'function') {
        p.catch((err) => {
          logWinAudio('celebration fireworks play() REJECTED', {
            error: err instanceof Error ? err.message : String(err),
          })
        })
      }
    } catch (err) {
      logWinAudio('celebration fireworks play() threw', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (el.readyState >= 1 && Number.isFinite(el.duration) && el.duration > 0) {
    startPlayback()
  } else {
    el.addEventListener('loadedmetadata', () => startPlayback(), { once: true })
  }

  return el
}

export function playCelebrationSound() {
  return playSound('celebration')
}

// ---- Bingo win jingle (Web Audio, short generated effect) ------------------

let bingoJingleCtx: AudioContext | null = null

function getBingoJingleContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!bingoJingleCtx) bingoJingleCtx = new Ctor()
  return bingoJingleCtx
}

/**
 * Short celebratory bingo jingle (~1.5s) for bingo-stage wins on the display
 * and the winning team's phone. Generated via Web Audio — not the event-winner
 * mp3 sequence.
 */
export function playBingoWinJingle(): void {
  const ctx = getBingoJingleContext()
  if (!ctx) return

  void ctx.resume().then(() => {
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.38, now)
    master.connect(ctx.destination)

    // Bright major arpeggio (bell-like sine partials).
    const arpeggio: { f: number; t: number; d: number; vol: number }[] = [
      { f: 523.25, t: 0, d: 0.18, vol: 0.7 },
      { f: 659.25, t: 0.07, d: 0.18, vol: 0.65 },
      { f: 783.99, t: 0.14, d: 0.2, vol: 0.7 },
      { f: 1046.5, t: 0.22, d: 0.28, vol: 0.75 },
      { f: 1318.51, t: 0.34, d: 0.35, vol: 0.55 },
    ]

    for (const note of arpeggio) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(note.f, now + note.t)
      gain.gain.setValueAtTime(0.0001, now + note.t)
      gain.gain.exponentialRampToValueAtTime(note.vol, now + note.t + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.t + note.d)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now + note.t)
      osc.stop(now + note.t + note.d + 0.04)
    }

    // Cash-register "ding" finish.
    const ding = ctx.createOscillator()
    const dingGain = ctx.createGain()
    ding.type = 'triangle'
    ding.frequency.setValueAtTime(1760, now + 0.52)
    dingGain.gain.setValueAtTime(0.0001, now + 0.52)
    dingGain.gain.exponentialRampToValueAtTime(0.65, now + 0.53)
    dingGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15)
    ding.connect(dingGain)
    dingGain.connect(master)
    ding.start(now + 0.52)
    ding.stop(now + 1.2)
  }).catch(() => {
    // Autoplay policy — silent no-op
  })
}

// ---- Event winner celebration sequence (mp3, display only) -----------------

// Track the active event-winner celebration sequence so a new win stops the
// previous one instead of stacking multiple songs on top of each other.
let activeWinSequenceStop: (() => void) | null = null

/**
 * Overall event-winner celebration on the display: winner.mp3 + cheer.mp3 start
 * together, crossfade into celebration.mp3 over the last 5s of the fanfare,
 * and play the last 20s of fireworks.mp3. Not used for bingo-stage wins.
 *
 * Returns a stop() that halts the whole sequence.
 */
export function playEventWinnerSequence(): () => void {
  return playBingoWinSequence(true)
}

/**
 * @deprecated Use playEventWinnerSequence for event winner reveal, or
 * playBingoWinJingle for bingo wins.
 */
export function playBingoWinSequence(isDisplay: boolean): () => void {
  logWinAudio('playBingoWinSequence called', { isDisplay })
  unlockSounds()
  // Stop any previous celebration before starting a new one (frees its element).
  activeWinSequenceStop?.()

  if (typeof Audio === 'undefined') {
    logWinAudio('abort — Audio API unavailable')
    return () => {}
  }

  void fetch(soundUrl('celebration'), { method: 'HEAD' })
    .then((res) => {
      logWinAudio('celebration.mp3 HEAD check', {
        status: res.status,
        ok: res.ok,
        contentType: res.headers.get('content-type'),
        contentLength: res.headers.get('content-length'),
      })
    })
    .catch((err) => {
      logWinAudio('celebration.mp3 HEAD check FAILED', {
        error: err instanceof Error ? err.message : String(err),
      })
    })

  const winnerVol = clampVolume(SOUND_VOLUME.winner ?? 0.7)
  const celebVol = clampVolume(SOUND_VOLUME.celebration ?? 0.7)

  const winnerFromPool = acquire('winner')
  const celebrationFromPool = acquire('celebration')
  const winner = winnerFromPool ?? createEl('winner')
  const celebration = celebrationFromPool ?? createEl('celebration')
  logWinAudio('element acquisition', {
    winnerFromPool: Boolean(winnerFromPool),
    celebrationFromPool: Boolean(celebrationFromPool),
    winnerIsFreshElement: !winnerFromPool,
    celebrationIsFreshElement: !celebrationFromPool,
    celebrationPrimedBeforeStart: celebration ? primedElements.has(celebration) : false,
    celebrationSoundsUnlocked: celebrationSoundsUnlocked,
    operationalSoundsUnlocked: operationalSoundsUnlocked,
    winnerState: winner ? winAudioElementState(winner, 'winner') : null,
    celebrationState: celebration ? winAudioElementState(celebration, 'celebration') : null,
  })

  if (!winner || !celebration) {
    logWinAudio('abort — missing winner or celebration element, falling back to playWinnerSound')
    playWinnerSound()
    return () => {}
  }

  celebration.addEventListener(
    'loadedmetadata',
    () => {
      logWinAudio('celebration loadedmetadata', winAudioElementState(celebration, 'celebration'))
    },
    { once: true },
  )
  celebration.addEventListener(
    'canplaythrough',
    () => {
      logWinAudio('celebration canplaythrough', winAudioElementState(celebration, 'celebration'))
    },
    { once: true },
  )

  ensureElementPrimed(winner)
  ensureElementPrimed(celebration)
  winner.muted = false
  celebration.muted = false
  winner.volume = winnerVol
  celebration.volume = 0
  try {
    winner.currentTime = 0
  } catch {
    // ignore
  }

  logWinAudio('winner duration before play', {
    duration: winner.duration,
    isNaN: Number.isNaN(winner.duration),
    isZero: winner.duration === 0,
    readyState: winner.readyState,
  })

  // Crowd cheer plays with the fanfare. Fireworks finale only on the display.
  playSound('cheer')
  if (isDisplay) playCelebrationFireworksSound()

  let fadeTimer: number | undefined
  let crossfadeTimer: number | undefined
  let safetyTimer: number | undefined
  let crossfading = false
  let celebrationStarted = false

  const startCelebration = (atFullVolume: boolean, reason: string) => {
    if (celebrationStarted) {
      logWinAudio('startCelebration skipped — already started', { reason })
      return
    }
    celebrationStarted = true
    ensureElementPrimed(celebration)
    celebration.muted = false
    if (atFullVolume) celebration.volume = celebVol
    logWinAudio('startCelebration — calling celebration.play()', {
      reason,
      atFullVolume,
      beforePlay: winAudioElementState(celebration, 'celebration'),
    })
    try {
      celebration.currentTime = 0
    } catch (err) {
      logWinAudio('startCelebration — currentTime=0 threw', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
    logWinAudio('startCelebration — state immediately before play()', {
      ...winAudioElementState(celebration, 'celebration'),
    })
    const p = celebration.play()
    if (p && typeof p.then === 'function') {
      p.then(() => {
        logWinAudio('celebration.play() RESOLVED', {
          reason,
          afterPlay: winAudioElementState(celebration, 'celebration'),
        })
      }).catch((err) => {
        logWinAudio('celebration.play() REJECTED', {
          reason,
          error: err instanceof Error ? err.message : String(err),
          err,
          afterReject: winAudioElementState(celebration, 'celebration'),
        })
      })
    } else {
      logWinAudio('celebration.play() returned no promise (sync path)', {
        reason,
        afterPlay: winAudioElementState(celebration, 'celebration'),
      })
    }
  }

  const beginCrossfade = () => {
    if (crossfading) {
      logWinAudio('beginCrossfade skipped — already crossfading')
      return
    }
    crossfading = true
    logWinAudio('beginCrossfade starting', {
      winnerCurrentTime: winner.currentTime,
      winnerDuration: winner.duration,
      celebrationPaused: celebration.paused,
    })
    if (crossfadeTimer) {
      window.clearTimeout(crossfadeTimer)
      crossfadeTimer = undefined
    }
    startCelebration(false, 'crossfade')
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
        logWinAudio('crossfade interval complete — pausing winner', {
          celebrationState: winAudioElementState(celebration, 'celebration'),
        })
        try {
          winner.pause()
        } catch {
          // ignore
        }
        celebration.volume = celebVol
      }
    }, stepMs)
  }

  const scheduleCrossfadeFromDuration = (source: string) => {
    const dur = winner.duration
    logWinAudio('scheduleCrossfadeFromDuration attempt', {
      source,
      duration: dur,
      isNaN: Number.isNaN(dur),
      isZero: dur === 0,
      isFinite: Number.isFinite(dur),
      crossfadeWindowSec: WIN_CROSSFADE_SEC,
    })
    if (!dur || Number.isNaN(dur) || !Number.isFinite(dur) || dur <= WIN_CROSSFADE_SEC) {
      logWinAudio('scheduleCrossfadeFromDuration FAILED — invalid duration', {
        source,
        duration: dur,
      })
      return false
    }
    if (crossfadeTimer) window.clearTimeout(crossfadeTimer)
    const msUntilFade = Math.max(0, (dur - WIN_CROSSFADE_SEC) * 1000)
    const triggerAtOffset = dur - WIN_CROSSFADE_SEC
    crossfadeTimer = window.setTimeout(() => beginCrossfade(), msUntilFade)
    logWinAudio('crossfade SCHEDULED', {
      source,
      duration: dur,
      msUntilFade,
      triggerAtOffsetSec: triggerAtOffset,
      crossfadeTimerId: crossfadeTimer,
    })
    return true
  }

  const onTime = () => {
    const dur = winner.duration
    if (!dur || Number.isNaN(dur) || !Number.isFinite(dur)) return
    const remaining = dur - winner.currentTime
    if (remaining <= WIN_CROSSFADE_SEC + 1) {
      logWinAudio('winner timeupdate near end', {
        currentTime: winner.currentTime,
        duration: dur,
        remaining,
        crossfading,
        celebrationStarted,
      })
    }
    if (remaining <= WIN_CROSSFADE_SEC) beginCrossfade()
  }
  winner.addEventListener('timeupdate', onTime)
  winner.addEventListener(
    'loadedmetadata',
    () => {
      logWinAudio('winner loadedmetadata', winAudioElementState(winner, 'winner'))
      scheduleCrossfadeFromDuration('winner.loadedmetadata')
    },
    { once: true },
  )
  winner.addEventListener('durationchange', () => {
    logWinAudio('winner durationchange', winAudioElementState(winner, 'winner'))
    scheduleCrossfadeFromDuration('winner.durationchange')
  })

  // Fallback 1: if the crossfade window never triggers, start celebration when
  // winner.mp3 ends, at full volume.
  winner.addEventListener(
    'ended',
    () => {
      logWinAudio('winner ENDED fallback firing', {
        celebrationStarted,
        winnerState: winAudioElementState(winner, 'winner'),
      })
      if (!celebrationStarted) startCelebration(true, 'winner.ended')
    },
    { once: true },
  )

  logWinAudio('calling winner.play()', winAudioElementState(winner, 'winner'))
  const wp = winner.play()
  if (wp && typeof wp.then === 'function') {
    wp.then(() => {
      logWinAudio('winner.play() RESOLVED', {
        duration: winner.duration,
        isNaN: Number.isNaN(winner.duration),
        isZero: winner.duration === 0,
        readyState: winner.readyState,
        currentTime: winner.currentTime,
      })
      scheduleCrossfadeFromDuration('winner.play().then')
    }).catch((err) => {
      logWinAudio('winner.play() REJECTED', {
        error: err instanceof Error ? err.message : String(err),
        err,
      })
      // Fallback 2: if the fanfare is blocked, go straight to the celebration.
      startCelebration(true, 'winner.play() rejected')
    })
  } else {
    logWinAudio('winner.play() sync path (no promise)')
    scheduleCrossfadeFromDuration('winner.play() sync')
  }

  // Fallback 3: hard safety — if nothing started the song within 20s, start it.
  safetyTimer = window.setTimeout(() => {
    logWinAudio('20s SAFETY fallback firing', {
      celebrationStarted,
      winnerState: winAudioElementState(winner, 'winner'),
      celebrationState: winAudioElementState(celebration, 'celebration'),
    })
    if (!celebrationStarted) startCelebration(true, '20s safety')
  }, 20_000)

  const stop = () => {
    logWinAudio('sequence stop() called', {
      celebrationStarted,
      crossfading,
      winnerPaused: winner.paused,
      celebrationPaused: celebration.paused,
    })
    if (fadeTimer) window.clearInterval(fadeTimer)
    if (crossfadeTimer) window.clearTimeout(crossfadeTimer)
    if (safetyTimer) window.clearTimeout(safetyTimer)
    fadeTimer = undefined
    crossfadeTimer = undefined
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
