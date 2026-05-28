function withAudio(run: (ctx: AudioContext) => void) {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    run(ctx)
    window.setTimeout(() => void ctx.close(), 1200)
    if (ctx.state === 'suspended') void ctx.resume()
    void now
  } catch {
    // ignore if audio blocked
  }
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, type: OscillatorType = 'sine', gainPeak = 0.14) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

/** Exciting, upbeat ascending chime for team submissions. */
export function playSubmitSound() {
  withAudio((ctx) => {
    const t = ctx.currentTime
    tone(ctx, 740, t, 0.11, 'triangle', 0.12)
    tone(ctx, 988, t + 0.08, 0.12, 'triangle', 0.14)
    tone(ctx, 1319, t + 0.16, 0.15, 'sine', 0.16)
  })
}

/** Distinct facilitator alert for newly arrived pending submissions. */
export function playNewSubmissionSound() {
  withAudio((ctx) => {
    const t = ctx.currentTime
    tone(ctx, 520, t, 0.12, 'square', 0.11)
    tone(ctx, 780, t + 0.14, 0.14, 'square', 0.1)
  })
}

/** Soft short message chime for chat. */
export function playNewMessageSound() {
  withAudio((ctx) => {
    const t = ctx.currentTime
    tone(ctx, 660, t, 0.08, 'sine', 0.08)
    tone(ctx, 880, t + 0.06, 0.1, 'sine', 0.08)
  })
}

/** Gentle push toast pop/ding sound. */
export function playPushNotificationSound() {
  withAudio((ctx) => {
    const t = ctx.currentTime
    tone(ctx, 540, t, 0.09, 'triangle', 0.1)
  })
}

/** Longer dramatic fanfare for announcements. */
export function playAnnouncementSound() {
  withAudio((ctx) => {
    const t = ctx.currentTime
    tone(ctx, 392, t, 0.2, 'sawtooth', 0.08)
    tone(ctx, 523.25, t + 0.16, 0.2, 'sawtooth', 0.09)
    tone(ctx, 659.25, t + 0.32, 0.24, 'triangle', 0.11)
    tone(ctx, 784, t + 0.48, 0.34, 'triangle', 0.13)
  })
}

/** Soft click for quiz option selection. */
export function playQuizSelectSound() {
  withAudio((ctx) => {
    const t = ctx.currentTime
    tone(ctx, 420, t, 0.05, 'square', 0.06)
  })
}

/** Happy ascending melody for correct reveal. */
export function playQuizCorrectSound() {
  withAudio((ctx) => {
    const t = ctx.currentTime
    tone(ctx, 523.25, t, 0.11, 'triangle', 0.1)
    tone(ctx, 659.25, t + 0.1, 0.12, 'triangle', 0.1)
    tone(ctx, 783.99, t + 0.2, 0.16, 'triangle', 0.12)
  })
}

/** Short descending tone for wrong reveal. */
export function playQuizWrongSound() {
  withAudio((ctx) => {
    const t = ctx.currentTime
    tone(ctx, 440, t, 0.1, 'sawtooth', 0.09)
    tone(ctx, 329.63, t + 0.09, 0.16, 'sawtooth', 0.08)
  })
}

/** Urgent pulse for quiz timer under 5 seconds. */
export function playQuizTimerWarningSound() {
  withAudio((ctx) => {
    const t = ctx.currentTime
    tone(ctx, 980, t, 0.045, 'square', 0.07)
  })
}
