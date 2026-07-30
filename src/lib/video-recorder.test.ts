import { afterEach, describe, expect, it, vi } from 'vitest'

import { pickVideoRecorderMime } from '@/lib/video-recorder'

function stubUserAgent(ua: string) {
  vi.stubGlobal('navigator', { ...navigator, userAgent: ua })
}

function stubMediaRecorder(supported: string[]) {
  vi.stubGlobal('MediaRecorder', {
    isTypeSupported: (mime: string) => supported.includes(mime),
  })
}

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'

/**
 * `video/mp4` on Android hands recording to a hardware encoder that shares the
 * camera pipeline with the live preview, which is a known source of a black,
 * flickering preview and no output the moment recording starts. Android must
 * get vp9/vp8 (software encoder) ahead of mp4; every other platform keeps mp4
 * first since Safari has no vp8/vp9 MediaRecorder support at all.
 */
describe('pickVideoRecorderMime', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefers vp9 over mp4 on Android when both are supported', () => {
    stubUserAgent(ANDROID_UA)
    stubMediaRecorder(['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8'])
    expect(pickVideoRecorderMime()).toBe('video/webm;codecs=vp9')
  })

  it('falls back through vp8 to mp4 on Android if webm is unsupported', () => {
    stubUserAgent(ANDROID_UA)
    stubMediaRecorder(['video/mp4'])
    expect(pickVideoRecorderMime()).toBe('video/mp4')
  })

  it('prefers mp4 on non-Android platforms', () => {
    stubUserAgent(DESKTOP_UA)
    stubMediaRecorder(['video/mp4', 'video/webm;codecs=vp9'])
    expect(pickVideoRecorderMime()).toBe('video/mp4')
  })
})
