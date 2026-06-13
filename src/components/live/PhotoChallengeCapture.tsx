import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, SwitchCamera, X } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/notification-context'
import { getTeamMediaStream } from '@/lib/media-permissions'
import { playShutterSound } from '@/lib/sounds'

type PhotoChallengeCaptureProps = {
  accentColor: string
  disabled?: boolean
  onClose: () => void
  onFileReady: (file: File) => void
}

export function PhotoChallengeCapture({
  accentColor,
  disabled,
  onClose,
  onFileReady,
}: PhotoChallengeCaptureProps) {
  const { notify } = useNotification()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setReady(false)
  }

  useEffect(() => {
    void startCamera(facingMode)
    return () => {
      stopStream()
    }
  }, [])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !streamRef.current || snapshot) return
    el.srcObject = streamRef.current
    void el.play().catch(() => {})
  }, [ready, snapshot])

  async function startCamera(facing: 'environment' | 'user') {
    stopStream()
    const stream = await getTeamMediaStream({
      video: { facingMode: facing },
      audio: false,
    })
    if (!stream) {
      notify('Camera access not granted — allow camera when the app opens')
      return
    }
    streamRef.current = stream
    setReady(true)
  }

  function flipCamera() {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    setSnapshot(null)
    void startCamera(next)
  }

  function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
    playShutterSound()
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setSnapshot(dataUrl)
    stopStream()
  }

  function retake() {
    setSnapshot(null)
    void startCamera(facingMode)
  }

  function cancelCapture() {
    stopStream()
    setSnapshot(null)
    onClose()
  }

  function submitPhoto() {
    if (!snapshot) return
    fetch(snapshot)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onFileReady(file)
      })
      .catch(() => notify('Could not process photo'))
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="experience-scope fixed inset-0 z-[10000] flex flex-col bg-black">
      <canvas ref={canvasRef} className="hidden" />
      <div
        className="flex shrink-0 items-center justify-end px-4 pb-2"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={cancelCapture}
          aria-label="Close capture"
          className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center px-3">
        <div className="xp-media-frame mx-auto w-full max-w-lg overflow-hidden rounded-xl bg-black">
          {snapshot ? (
            <img src={snapshot} alt="Preview" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-[4/3] w-full bg-black object-cover"
              />
              <button
                type="button"
                onClick={flipCamera}
                disabled={!ready}
                aria-label="Switch camera"
                className="absolute right-3 top-3 flex min-h-11 items-center gap-1.5 rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm disabled:opacity-50"
              >
                <SwitchCamera className="size-4" />
                Flip
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        className="shrink-0 space-y-3 px-4 pt-3"
        style={{
          paddingBottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 3.5rem))',
        }}
      >
        {snapshot ? (
          <div className="mx-auto flex w-full max-w-lg gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 flex-1 border-white/30 bg-white/10 text-base text-white"
              onClick={retake}
            >
              Retake
            </Button>
            <LiveAccentButton
              type="button"
              className="min-h-12 flex-1 text-base"
              accentColor={accentColor}
              disabled={disabled}
              onClick={submitPhoto}
            >
              Submit
            </LiveAccentButton>
          </div>
        ) : (
          <LiveAccentButton
            type="button"
            className="mx-auto min-h-12 w-full max-w-lg gap-2 text-base"
            accentColor={accentColor}
            disabled={disabled || !ready}
            onClick={capturePhoto}
          >
            <Camera className="size-5" />
            Take photo
          </LiveAccentButton>
        )}
      </div>
    </div>,
    document.body,
  )
}
