/**
 * Local-only stand-in for a phone's camera, so capture flows can be driven
 * without a device.
 *
 * Enabled with `?fakecam` on any page. It replaces getUserMedia with a canvas
 * stream, answers the Permissions API, and can pretend to be an iPhone or an
 * Android so the platform-specific branches in capture-platform.ts are actually
 * exercised. It also exposes `window.rallyhubCapture` so a synthetic photo or
 * video file can be dropped into any file input, which is the only way to reach
 * the iOS path: shouldUseNativePhotoCapture() sends iOS to a native
 * `<input capture>` rather than to getUserMedia.
 *
 * What it does not do: prove real device behaviour. It fools JavaScript, not
 * the engine, so iOS Safari's real autoplay rules, HEIC handling, codec support
 * and orientation still need a real phone before shipping. It is for finding
 * logic and layout bugs, not for signing off hardware.
 *
 * Never reaches a deployed site: see captureHarnessRequest, which refuses
 * anything but localhost.
 */

export type FakeCameraMode =
  /** Working camera, the default. */
  | 'ok'
  /** getUserMedia rejects like a user pressing Block. */
  | 'deny'
  /** No camera hardware at all. */
  | 'nodevice'
  /** Video works, audio does not, which is a common phone state. */
  | 'noaudio'

export type DeviceProfile = 'ios' | 'ipad' | 'android' | 'desktop'

type HarnessRequest = {
  mode: FakeCameraMode
  device: DeviceProfile
  /** Same-origin image or video to film instead of the test pattern. */
  source: string | null
  /** Sensor size the fake camera reports, as [width, height] in pixels. */
  resolution: [number, number]
}

const DEVICE_PROFILES: Record<
  Exclude<DeviceProfile, 'desktop'>,
  { userAgent: string; platform: string; maxTouchPoints: number }
> = {
  ios: {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    maxTouchPoints: 5,
  },
  // Deliberately the desktop-Safari user agent iPadOS actually sends, so the
  // MacIntel-plus-touch branch of isIOSOrIPadOS gets exercised rather than the
  // easy /iPad/ string match.
  ipad: {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
  },
  android: {
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
  },
}

/**
 * Reads the request from the URL, and refuses to arm anywhere but a local
 * machine.
 *
 * The host check, rather than `import.meta.env.DEV` alone, is what lets a
 * production build be tested through `npm run preview`, where the DEV flag is
 * false and the code being exercised is the code that actually ships. It is
 * also the security boundary: a bundle that can be told to fake a camera must
 * never do so on a real origin, whatever the query string says.
 */
export function captureHarnessRequest(): HarnessRequest | null {
  if (typeof window === 'undefined') return null

  const host = window.location.hostname
  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')
  if (!isLocal) return null

  const params = new URLSearchParams(window.location.search)
  if (!params.has('fakecam')) return null

  const raw = params.get('fakecam')
  const mode: FakeCameraMode =
    raw === 'deny' || raw === 'nodevice' || raw === 'noaudio' ? raw : 'ok'

  const requested = params.get('device')
  const device: DeviceProfile =
    requested === 'ios' || requested === 'ipad' || requested === 'android'
      ? requested
      : 'desktop'

  // Same-origin only. A cross-origin image or video taints the canvas, which
  // silently breaks captureStream and toBlob, so the failure would look like a
  // bug in the app rather than in the harness.
  const rawSource = params.get('camsrc')
  const source = rawSource && rawSource.startsWith('/') ? rawSource : null

  const rawResolution = params.get('camres')?.match(/^(\d{2,5})x(\d{2,5})$/)
  const resolution: [number, number] = rawResolution
    ? [Number(rawResolution[1]), Number(rawResolution[2])]
    : [1080, 1920]

  return { mode, device, source, resolution }
}

/** Patches the three things capture-platform.ts reads to decide the path. */
function applyDeviceProfile(device: DeviceProfile) {
  if (device === 'desktop') return
  const profile = DEVICE_PROFILES[device]

  for (const [key, value] of Object.entries({
    userAgent: profile.userAgent,
    platform: profile.platform,
    maxTouchPoints: profile.maxTouchPoints,
  })) {
    try {
      Object.defineProperty(navigator, key, { get: () => value, configurable: true })
    } catch {
      // Some engines make these non-configurable; the rest of the harness still
      // works, the platform branch just stays whatever the browser really is.
    }
  }
}

/**
 * Films a real image or video file instead of the test pattern.
 *
 * This is what makes framing questions answerable: the scene is drawn to fill
 * the sensor frame the way a real camera fills it, so cropping, letterboxing,
 * a stretched preview or a sideways result all show up. A video source is
 * handed straight to captureStream, so its real frame rate and motion reach the
 * recorder.
 *
 * It says nothing about performance. The frame rate here is this machine's, not
 * a phone's, so smooth output is not evidence that a phone would be smooth.
 */
async function sourceStream(
  url: string,
  [width, height]: [number, number],
): Promise<MediaStream> {
  const isVideo = /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url)

  if (isVideo) {
    const video = document.createElement('video')
    video.src = url
    video.loop = true
    video.muted = true
    video.playsInline = true
    await video.play()
    const stream = (
      video as HTMLVideoElement & { captureStream: () => MediaStream }
    ).captureStream()
    for (const track of stream.getVideoTracks()) {
      track.applyConstraints = () => Promise.resolve()
    }
    return stream
  }

  const image = new Image()
  image.src = url
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  let frame = 0
  window.setInterval(() => {
    frame += 1
    // Cover, not contain: a camera sensor is filled by the scene, so this is
    // where a wrong aspect ratio in the app becomes visible.
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height)
    const w = image.width * scale
    const h = image.height * scale
    ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)

    // Small liveness marker in the corner, out of the way of the picture.
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, canvas.height - 44, 210, 44)
    ctx.fillStyle = '#ffc107'
    ctx.textAlign = 'left'
    ctx.font = '28px sans-serif'
    ctx.fillText(`frame ${frame}`, 12, canvas.height - 14)
  }, 100)

  const stream = canvas.captureStream(30)
  for (const track of stream.getVideoTracks()) {
    track.applyConstraints = () => Promise.resolve()
  }
  return stream
}

/** A moving test pattern, labelled so a screenshot says which camera it is. */
function patternStream(
  label: string,
  accent: string,
  [width, height]: [number, number] = [1080, 1920],
): MediaStream {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  let frame = 0
  window.setInterval(() => {
    frame += 1
    ctx.fillStyle = '#101014'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = '#3a3a44'
    ctx.lineWidth = 4
    for (let i = 1; i < 3; i += 1) {
      ctx.beginPath()
      ctx.moveTo((canvas.width * i) / 3, 0)
      ctx.lineTo((canvas.width * i) / 3, canvas.height)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, (canvas.height * i) / 3)
      ctx.lineTo(canvas.width, (canvas.height * i) / 3)
      ctx.stroke()
    }

    // A travelling bar, so a still screenshot proves the stream is live and a
    // frozen preview is obvious.
    ctx.fillStyle = accent
    ctx.fillRect(0, (frame * 12) % canvas.height, canvas.width, 8)

    ctx.fillStyle = accent
    ctx.textAlign = 'center'
    ctx.font = 'bold 72px sans-serif'
    ctx.fillText(label, canvas.width / 2, canvas.height / 2)
    ctx.fillStyle = '#8a8a96'
    ctx.font = '48px sans-serif'
    ctx.fillText(`frame ${frame}`, canvas.width / 2, canvas.height / 2 + 90)
  }, 100)

  const stream = canvas.captureStream(30)
  for (const track of stream.getVideoTracks()) {
    // The capture code negotiates portrait sizes against a real camera. A
    // canvas track obeys them literally and collapsed the preview to a couple
    // of pixels, so constraints are accepted and ignored.
    track.applyConstraints = () => Promise.resolve()
  }
  return stream
}

function silentAudioTrack(): MediaStreamTrack | null {
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return null
  const context = new AudioCtor()
  const destination = context.createMediaStreamDestination()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  gain.gain.value = 0.0001
  oscillator.connect(gain)
  gain.connect(destination)
  oscillator.start()
  return destination.stream.getAudioTracks()[0] ?? null
}

/** DOMException shaped like the ones a real browser throws, so error branches match. */
function mediaError(name: 'NotAllowedError' | 'NotFoundError'): DOMException {
  return new DOMException(
    name === 'NotAllowedError' ? 'Permission denied' : 'Requested device not found',
    name,
  )
}

export async function installCaptureHarness({
  mode,
  device,
  source,
  resolution,
}: HarnessRequest) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) return

  applyDeviceProfile(device)

  let back: MediaStream
  try {
    back = source
      ? await sourceStream(source, resolution)
      : patternStream('BACK CAMERA', '#ffc107', resolution)
  } catch (error) {
    // A missing or unplayable file must not look like a broken camera.
    console.warn('[dev] camsrc could not be loaded, using the test pattern', error)
    back = patternStream('BACK CAMERA', '#ffc107', resolution)
  }
  // The front camera stays a pattern even with a source file: it is there to
  // prove the facingMode switch changed something.
  const front = patternStream('FRONT CAMERA', '#4fc3f7', resolution)
  let audio: MediaStreamTrack | null = null

  navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    if (mode === 'deny') throw mediaError('NotAllowedError')
    if (mode === 'nodevice') throw mediaError('NotFoundError')

    // Honour facingMode so the front/back switch is visibly doing something.
    const video = constraints?.video
    const facing =
      typeof video === 'object' && video !== null
        ? (video as MediaTrackConstraints).facingMode
        : undefined
    const wantsFront =
      typeof facing === 'string'
        ? facing === 'user'
        : typeof facing === 'object' && facing !== null
          ? (facing as ConstrainDOMStringParameters).exact === 'user' ||
            (facing as ConstrainDOMStringParameters).ideal === 'user'
          : false

    const source = wantsFront ? front : back
    const stream = new MediaStream(source.getVideoTracks())

    if (constraints?.audio && mode !== 'noaudio') {
      audio ??= silentAudioTrack()
      if (audio) stream.addTrack(audio)
    }
    return stream
  }

  navigator.mediaDevices.enumerateDevices = async () => {
    if (mode === 'nodevice') return []
    return [
      { kind: 'videoinput', deviceId: 'fake-back', groupId: 'g1', label: 'Simulated back camera' },
      { kind: 'videoinput', deviceId: 'fake-front', groupId: 'g2', label: 'Simulated front camera' },
      ...(mode === 'noaudio'
        ? []
        : [{ kind: 'audioinput', deviceId: 'fake-mic', groupId: 'g3', label: 'Simulated microphone' }]),
    ].map((d) => ({ ...d, toJSON: () => d })) as MediaDeviceInfo[]
  }

  // The join screen asks the Permissions API before prompting, so without this
  // it would think the camera is blocked and never reach getUserMedia.
  if (navigator.permissions?.query) {
    const realQuery = navigator.permissions.query.bind(navigator.permissions)
    navigator.permissions.query = async (descriptor: PermissionDescriptor) => {
      const name = descriptor?.name as string
      if (name === 'camera' || name === 'microphone') {
        const state: PermissionState =
          mode === 'deny' ? 'denied' : mode === 'nodevice' ? 'prompt' : 'granted'
        return {
          name,
          state,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent: () => false,
        } as unknown as PermissionStatus
      }
      return realQuery(descriptor)
    }
  }

  installFileHelpers(back)
  console.info(
    `[dev] Capture harness: mode=${mode}, device=${device}, source=${source ?? 'test pattern'}, sensor=${resolution[0]}x${resolution[1]}`,
  )
}

/**
 * Puts a synthetic photo or video into a file input.
 *
 * iOS never reaches getUserMedia for photos, it opens a native picker, and the
 * "or upload" fallbacks are file inputs too. A file picker cannot be driven
 * from a script, so these build a real File and hand it to the input the way a
 * chosen file arrives, which is the only way those branches can be tested
 * without a person holding a phone.
 */
function installFileHelpers(source: MediaStream) {
  function give(input: HTMLInputElement, file: File) {
    const data = new DataTransfer()
    data.items.add(file)
    input.files = data.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }

  async function photoFile(): Promise<File> {
    const track = source.getVideoTracks()[0]
    const settings = track.getSettings()
    const canvas = document.createElement('canvas')
    canvas.width = settings.width ?? 1080
    canvas.height = settings.height ?? 1920

    const video = document.createElement('video')
    video.srcObject = source
    video.muted = true
    await video.play()
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    video.pause()

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9),
    )
    return new File([blob], 'simulated-photo.jpg', { type: 'image/jpeg' })
  }

  async function videoFile(ms = 1200): Promise<File> {
    const recorder = new MediaRecorder(source)
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => chunks.push(event.data)
    recorder.start()
    await new Promise((resolve) => window.setTimeout(resolve, ms))
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve()
      recorder.stop()
    })
    const type = recorder.mimeType || 'video/webm'
    return new File([new Blob(chunks, { type })], 'simulated-video.webm', { type })
  }

  ;(window as unknown as { rallyhubCapture: unknown }).rallyhubCapture = {
    /** Drop a photo into the first matching file input, or one you pass in. */
    async photo(target?: HTMLInputElement | string) {
      const input = resolveInput(target, 'image')
      if (!input) throw new Error('No matching file input found')
      give(input, await photoFile())
      return input
    },
    async video(target?: HTMLInputElement | string, ms?: number) {
      const input = resolveInput(target, 'video')
      if (!input) throw new Error('No matching file input found')
      give(input, await videoFile(ms))
      return input
    },
    /** Every file input on the page, for when the right one is not obvious. */
    inputs: () =>
      Array.from(document.querySelectorAll<HTMLInputElement>('input[type=file]')).map(
        (input) => ({ accept: input.accept, capture: input.getAttribute('capture') }),
      ),
  }

  function resolveInput(
    target: HTMLInputElement | string | undefined,
    kind: 'image' | 'video',
  ): HTMLInputElement | null {
    if (target instanceof HTMLInputElement) return target
    if (typeof target === 'string') return document.querySelector<HTMLInputElement>(target)
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type=file]'),
    )
    return inputs.find((i) => i.accept.includes(kind)) ?? inputs[0] ?? null
  }
}
