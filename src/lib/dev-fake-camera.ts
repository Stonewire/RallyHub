/**
 * Development-only camera stand-in, enabled with `?fakecam=1` on any page.
 *
 * The capture screens are the one part of the participant flow that cannot be
 * reviewed without a camera, and a laptop webcam is both awkward and beside
 * the point when what is being checked is layout. This feeds getUserMedia a
 * canvas stream instead, so the capture UI opens and records for real against
 * a test pattern.
 *
 * Never reaches production: the caller is behind `import.meta.env.DEV`.
 */
export function installFakeCamera() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) return

  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const ctx = canvas.getContext('2d')
  if (!ctx) return

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
    ctx.fillStyle = '#8a8a96'
    ctx.textAlign = 'center'
    ctx.font = 'bold 64px sans-serif'
    ctx.fillText('SIMULATED CAMERA', canvas.width / 2, canvas.height / 2)
    ctx.font = '48px sans-serif'
    ctx.fillText(String(frame), canvas.width / 2, canvas.height / 2 + 80)
  }, 100)

  const canvasStream = canvas.captureStream(30)
  for (const track of canvasStream.getVideoTracks()) {
    // The capture code negotiates portrait sizes on the real camera. A canvas
    // track obeys those literally and collapsed the preview to a couple of
    // pixels, so here the constraints are simply accepted and ignored.
    track.applyConstraints = () => Promise.resolve()
  }

  let silentAudio: MediaStreamTrack | null = null
  function audioTrack(): MediaStreamTrack | null {
    if (silentAudio) return silentAudio
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioCtor) return null
    const audioContext = new AudioCtor()
    const destination = audioContext.createMediaStreamDestination()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    gain.gain.value = 0.0001
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start()
    silentAudio = destination.stream.getAudioTracks()[0] ?? null
    return silentAudio
  }

  navigator.mediaDevices.getUserMedia = async (constraints) => {
    const stream = new MediaStream(canvasStream.getVideoTracks())
    if (constraints?.audio) {
      const track = audioTrack()
      if (track) stream.addTrack(track)
    }
    return stream
  }

  navigator.mediaDevices.enumerateDevices = async () =>
    [
      { kind: 'videoinput', deviceId: 'fake-back', groupId: 'g1', label: 'Simulated back camera' },
      { kind: 'videoinput', deviceId: 'fake-front', groupId: 'g2', label: 'Simulated front camera' },
      { kind: 'audioinput', deviceId: 'fake-mic', groupId: 'g3', label: 'Simulated microphone' },
    ].map((device) => ({ ...device, toJSON: () => device })) as MediaDeviceInfo[]

  console.info('[dev] Fake camera installed (?fakecam=1)')
}
