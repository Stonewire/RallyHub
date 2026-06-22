// Real sound-file playback. Files live in public/sounds/ and are served from
// /sounds/<file>.mp3.
//
// Design notes:
// - Sounds are played CLEAN: no volume leveling, no crossfades, no layered
//   effects. Each file is mastered by us and played at its natural level. The
//   only processing is the browser's own mp3 decode.
// - Latency: every sound keeps a preloaded pool of HTMLAudioElements. Playing
//   resets currentTime and calls play() on an already-loaded element, so there
//   is no per-trigger element-creation / network delay. When all pooled
//   elements are busy (rapid-fire), a clone is added so overlaps never wait.
// - Autoplay: mobile browsers block programmatic play() until an element has
//   played once inside a user gesture. We prime (unlock) every pooled element
//   on the first user interaction so later realtime-triggered sounds actually
//   play.

const SOUND_DIR = '/sounds'

/**
 * Logical sound name → actual filename (without extension) when they differ.
 * Everything else uses its key as the filename. Spaces are URL-encoded.
 */
const SOUND_FILE: Record<string, string> = {
  // Single combined winner announcement (replaces the old 4-part sequence).
  winner: 'Winner Announcement',
  // Facilitator's "a new submission arrived" cue (players use `new-submission`).
  'new-submission-facilitator': 'submited-facilitator',
}

/**
 * Active sounds. Volume stays at 1.0 for every sound — we do not level or duck;
 * the files carry their own mastered levels.
 */
const ALL_SOUNDS = [
  'new-submission',
  'new-submission-facilitator',
  'new-message',
  'announcement',
  'quiz-select',
  'quiz-correct',
  'quiz-wrong',
  'video-start',
  'video-stop',
  'winner',
  'bingo-winner',
] as const

const DEFAULT_VOLUME = 1
const MAX_POOL_PER_SOUND = 8

// ---- Device-level mute (facilitator "Mute" toggle) -------------------------
// Per-device, persisted so it survives reload. Mutes every cue on THIS device
// only (each surface runs its own module instance).
const MUTED_STORAGE_KEY = 'rh-sound-muted'

let soundsMuted = (() => {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(MUTED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
})()

export function isSoundsMuted(): boolean {
  return soundsMuted
}

export function setSoundsMuted(muted: boolean): void {
  soundsMuted = muted
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0')
  } catch {
    // ignore
  }
}

/** "Celebration"-scoped sounds (unlocked on display/players, not facilitator). */
const CELEBRATION_SOUND_NAMES = new Set<string>(['winner', 'bingo-winner'])
const OPERATIONAL_SOUND_NAMES = ALL_SOUNDS.filter((s) => !CELEBRATION_SOUND_NAMES.has(s))

function soundFileName(name: string): string {
  return SOUND_FILE[name] ?? name
}

function soundUrl(name: string): string {
  return `${SOUND_DIR}/${encodeURIComponent(soundFileName(name))}.mp3`
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

let soundsPreloaded = false

/**
 * Build the preloaded element pools. Deferred until a live surface first needs
 * audio (first unlock gesture / ensureAudioReady) so public pages — marketing,
 * login, legal — never fetch any sound files. Idempotent.
 */
function preloadAll() {
  if (soundsPreloaded) return
  if (typeof Audio === 'undefined') return
  soundsPreloaded = true
  for (const name of ALL_SOUNDS) {
    const el = createEl(name)
    if (el) pools.set(name, [el])
  }
}

// ---- Shared Web Audio context + autoplay unlock ----------------------------

let operationalSoundsUnlocked = false
let celebrationSoundsUnlocked = false
const primedElements = new WeakSet<HTMLAudioElement>()
const primePromises = new WeakMap<HTMLAudioElement, Promise<void>>()

let sharedAudioContext: AudioContext | null = null
let audioUnlockListenersInstalled = false

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new Ctor()
  }
  return sharedAudioContext
}

async function resumeSharedAudioContext(): Promise<void> {
  const ctx = getSharedAudioContext()
  if (!ctx || ctx.state === 'closed') return
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // ignore — will retry on next playback
    }
  }
}

/** Play a silent buffer so iOS Safari keeps Web Audio unlocked after a gesture. */
function primeSharedAudioContext(): void {
  const ctx = getSharedAudioContext()
  if (!ctx || ctx.state === 'closed') return
  try {
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
    source.stop(0)
  } catch {
    // ignore
  }
}

function primeElement(el: HTMLAudioElement): Promise<void> {
  if (primedElements.has(el)) return Promise.resolve()
  const pending = primePromises.get(el)
  if (pending) return pending

  const promise = new Promise<void>((resolve) => {
    const finish = () => {
      primedElements.add(el)
      primePromises.delete(el)
      resolve()
    }
    try {
      const prevVolume = el.volume
      const prevMuted = el.muted
      // Must be fully silent during the brief unlock play — volume 0 alone is
      // not enough on every browser.
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
        finish()
      }
      const p = el.play()
      window.setTimeout(reset, 0)
      if (p && typeof p.then === 'function') {
        p.then(reset).catch(reset)
      }
    } catch {
      finish()
    }
  })
  primePromises.set(el, promise)
  return promise
}

async function primePoolSoundNames(names: readonly string[]): Promise<void> {
  if (typeof window === 'undefined') return
  const tasks: Promise<void>[] = []
  for (const name of names) {
    const pool = pools.get(name)
    if (!pool) continue
    for (const el of pool) tasks.push(primeElement(el))
  }
  await Promise.all(tasks)
}

/**
 * Prime short UI / notification sounds only. Used on the facilitator panel so
 * the winner announcement is never unlocked or played there until needed.
 */
export function unlockOperationalSounds() {
  if (operationalSoundsUnlocked || typeof window === 'undefined') return
  preloadAll()
  operationalSoundsUnlocked = true
  void primePoolSoundNames(OPERATIONAL_SOUND_NAMES)
}

/**
 * Prime every pooled sound element (operational + winner) so later programmatic
 * play() calls are not blocked. Safe to call multiple times.
 */
export function unlockSounds() {
  preloadAll()
  unlockOperationalSounds()
  if (celebrationSoundsUnlocked || typeof window === 'undefined') return
  celebrationSoundsUnlocked = true
  void primePoolSoundNames([...CELEBRATION_SOUND_NAMES])
}

/**
 * Call from an explicit user gesture (join button, sound gate tap, etc.).
 * Unlocks HTML audio pools and resumes/primes the shared AudioContext.
 */
export function unlockAudioFromUserGesture(scope: 'operational' | 'full' = 'full'): void {
  if (scope === 'full') unlockSounds()
  else unlockOperationalSounds()
  primeSharedAudioContext()
  void resumeSharedAudioContext()
}

/**
 * Install one-time listeners so the first tap/keypress on this device unlocks
 * audio. Team/display use `full`; facilitator uses `operational` only.
 */
export function installAudioUnlock(scope: 'operational' | 'full' = 'full'): void {
  if (typeof window === 'undefined') return
  preloadAll()
  audioUnlockListenersInstalled = true
  void audioUnlockListenersInstalled
  const onFirstGesture = () => unlockAudioFromUserGesture(scope)
  window.addEventListener('pointerdown', onFirstGesture, { once: true, passive: true })
  window.addEventListener('touchend', onFirstGesture, { once: true, passive: true })
  window.addEventListener('click', onFirstGesture, { once: true, passive: true })
  window.addEventListener('keydown', onFirstGesture, { once: true })
}

/**
 * Resume the shared AudioContext and ensure pooled elements are primed before
 * event-driven playback (chat, push notifications, winner reveal).
 */
export async function ensureAudioReady(celebration = false): Promise<void> {
  preloadAll()
  if (celebration) unlockSounds()
  else unlockOperationalSounds()

  const ctx = getSharedAudioContext()
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // ignore
    }
  }

  const names = celebration
    ? [...OPERATIONAL_SOUND_NAMES, ...CELEBRATION_SOUND_NAMES]
    : OPERATIONAL_SOUND_NAMES
  await primePoolSoundNames(names)
}

function ensureElementPrimed(el: HTMLAudioElement) {
  if (primedElements.has(el)) return
  void primeElement(el)
}

// ---- Core playback ---------------------------------------------------------

/** Get a free (paused/ended) pooled element, cloning a fresh one if all busy. */
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

function prepareSoundElement(name: string, volume?: number): HTMLAudioElement | null {
  const el = acquire(name)
  if (!el) return null
  ensureElementPrimed(el)
  el.muted = false
  el.volume = clampVolume(volume ?? DEFAULT_VOLUME)
  try {
    el.currentTime = 0
  } catch {
    // Seeking before metadata is loaded can throw on some browsers — ignore.
  }
  return el
}

async function playSoundImmediate(name: string, volume?: number): Promise<HTMLAudioElement | null> {
  if (soundsMuted) return null
  const el = prepareSoundElement(name, volume)
  if (!el) return null
  try {
    await el.play()
    return el
  } catch (err) {
    console.warn(`[sounds] could not play "${soundFileName(name)}.mp3"`, err)
    return null
  }
}

/**
 * Play a sound file by name from /sounds/ using a preloaded pooled element.
 * Resumes/primes audio before playback so event-driven sounds work on iOS
 * Safari. Never throws — autoplay rejections and load failures are logged.
 */
export function playSound(name: string, volume?: number): HTMLAudioElement | null {
  const celebration = CELEBRATION_SOUND_NAMES.has(name)
  void (async () => {
    await ensureAudioReady(celebration)
    const el = await playSoundImmediate(name, volume)
    if (!el) {
      await ensureAudioReady(celebration)
      await playSoundImmediate(name, volume)
    }
  })()
  return null
}

// ---- Public, named triggers ------------------------------------------------

/** Facilitator: a new submission arrived to review. */
export function playNewSubmissionSound() {
  void ensureAudioReady(false).then(() => playSoundImmediate('new-submission-facilitator'))
}

/** Players: generic push / submission notification. */
export function playPushNotificationSound() {
  void ensureAudioReady(false).then(() => playSoundImmediate('new-submission'))
}

export function playNewMessageSound() {
  void ensureAudioReady(false).then(() => playSoundImmediate('new-message'))
}

export function playAnnouncementSound() {
  void ensureAudioReady(false).then(() => playSoundImmediate('announcement'))
}

export function playQuizCorrectSound() {
  return playSound('quiz-correct')
}

export function playQuizWrongSound() {
  return playSound('quiz-wrong')
}

export function playVideoStartSound() {
  return playSound('video-start')
}

export function playVideoStopSound() {
  return playSound('video-stop')
}

// ---- Removed sounds (files intentionally deleted) — safe no-ops ------------
// Kept as no-ops so existing call sites compile and nothing 404s. The
// corresponding mp3s were removed from public/sounds on purpose.

/** Player's own "submitted" confirmation cue — uses the player submission sound. */
export function playSubmitSound() {
  void ensureAudioReady(false).then(() => playSoundImmediate('new-submission'))
}
/** Quiz answer-select confirmation cue (plays /sounds/quiz-select.mp3). */
export function playQuizSelectSound() {
  void ensureAudioReady(false).then(() => playSoundImmediate('quiz-select'))
}
/** @deprecated quiz timer-warning sound removed. */
export function playQuizTimerWarningSound() {}
/** @deprecated separate loser sound removed. */
export function playLoserSound() {}

// ---- Bingo win jingle (Web Audio, short generated cue) ---------------------

/**
 * Bingo line-win celebration cue for the display and the winning team's phone.
 * Plays the user-mastered bingo-winner.mp3 clean (same pooled path as winner).
 */
export function playBingoWinJingle(): void {
  void ensureAudioReady(true).then(() => playSoundImmediate('bingo-winner'))
}

// ---- Event winner announcement ---------------------------------------------

// Track the active winner playback so a new reveal stops the previous one
// instead of stacking, and so a facilitator reset can halt it.
let activeWinSequenceStop: (() => void) | null = null
let activeEventWinnerRevealKey: string | null = null

/** Clear dedupe guard when facilitator resets winner_reveal_stage to 0. */
export function resetEventWinnerAudioGuard(): void {
  activeEventWinnerRevealKey = null
}

function playWinnerInner(): () => void {
  if (soundsMuted) return () => {}
  const el = acquire('winner') ?? createEl('winner')
  if (!el) return () => {}
  ensureElementPrimed(el)
  el.muted = false
  el.volume = DEFAULT_VOLUME
  try {
    el.currentTime = 0
  } catch {
    // ignore
  }
  const p = el.play()
  if (p && typeof p.then === 'function') {
    p.catch((err) => console.warn('[sounds] winner announcement play() blocked', err))
  }
  return () => {
    try {
      el.pause()
      el.currentTime = 0
    } catch {
      // ignore
    }
  }
}

/**
 * Play the single winner announcement clean. Pass a stable `revealKey`
 * (e.g. `${eventId}:winner-reveal:2`) so re-renders and realtime re-delivery
 * only trigger it once per reveal. Returns a stop() that halts playback.
 */
export function playEventWinnerSequence(revealKey?: string): () => void {
  if (revealKey && activeEventWinnerRevealKey === revealKey) {
    return () => {}
  }
  if (revealKey) activeEventWinnerRevealKey = revealKey

  activeWinSequenceStop?.()

  let innerStop: () => void = () => {}
  let cancelled = false

  void ensureAudioReady(true).then(() => {
    if (cancelled) return
    if (revealKey && activeEventWinnerRevealKey !== revealKey) return
    innerStop = playWinnerInner()
  })

  const stop = () => {
    cancelled = true
    innerStop()
    if (revealKey && activeEventWinnerRevealKey === revealKey) {
      activeEventWinnerRevealKey = null
    }
    if (activeWinSequenceStop === stop) activeWinSequenceStop = null
  }
  activeWinSequenceStop = stop
  return stop
}
