import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, SwitchCamera, X } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/notification-context'
import {
  CHALLENGE_PREVIEW_MEDIA_CLASS,
  captureStillPhoto,
  downscalePhoto,
  getChallengeCameraStream,
  previewVideoStyle,
  streamNeedsQuarterTurn,
  type ChallengeFacingMode,
} from '@/lib/challenge-camera'

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
  const streamRef = useRef<MediaStream | null>(null)
  const snapshotUrlRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [facingMode, setFacingMode] = useState<ChallengeFacingMode>('environment')
  const [quarterTurn, setQuarterTurn] = useState(false)

  function revokeSnapshotUrl() {
    if (snapshotUrlRef.current) {
      URL.revokeObjectURL(snapshotUrlRef.current)
      snapshotUrlRef.current = null
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setReady(false)
    setQuarterTurn(false)
  }

  useEffect(() => {
    void startCamera(facingMode)
    return () => {
      stopStream()
      revokeSnapshotUrl()
    }
  }, [])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !streamRef.current || snapshotUrl) return
    el.srcObject = streamRef.current
    void el.play().catch(() => {})
  }, [ready, snapshotUrl, quarterTurn, facingMode])

  async function startCamera(facing: ChallengeFacingMode) {
    stopStream()
    const stream = await getChallengeCameraStream(facing, false)
    if (!stream) {
      notify('Camera access not granted — allow camera when the app opens')
      return
    }
    streamRef.current = stream
    setQuarterTurn(streamNeedsQuarterTurn(stream))
    setReady(true)
  }

  function flipCamera() {
    const next: ChallengeFacingMode =
      facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    revokeSnapshotUrl()
    setSnapshotUrl(null)
    void startCamera(next)
  }

  async function capturePhoto() {
    if (!streamRef.current || capturing) return
    setCapturing(true)
    try {
      const raw = await captureStillPhoto(streamRef.current, videoRef.current, { quarterTurn })
      const blob = await downscalePhoto(raw)
      revokeSnapshotUrl()
      const url = URL.createObjectURL(blob)
      snapshotUrlRef.current = url
      setSnapshotUrl(url)
      stopStream()
    } catch {
      notify('Could not capture photo — hold steady and try again')
    } finally {
      setCapturing(false)
    }
  }

  function retake() {
    revokeSnapshotUrl()
    setSnapshotUrl(null)
    void startCamera(facingMode)
  }

  function cancelCapture() {
    stopStream()
    revokeSnapshotUrl()
    setSnapshotUrl(null)
    onClose()
  }

  function submitPhoto() {
    if (!snapshotUrl) return
    fetch(snapshotUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onFileReady(file)
      })
      .catch(() => notify('Could not process photo'))
  }

  const livePreviewStyle = previewVideoStyle(facingMode, quarterTurn)

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="experience-scope fixed inset-0 z-[10000] flex flex-col bg-black">
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

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3">
        <div className="xp-media-frame mx-auto flex w-full max-w-lg items-center justify-center bg-black">
          {snapshotUrl ? (
            <img
              src={snapshotUrl}
              alt="Preview"
              className={CHALLENGE_PREVIEW_MEDIA_CLASS}
            />
          ) : (
            <div className="relative flex w-full items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={CHALLENGE_PREVIEW_MEDIA_CLASS}
                style={livePreviewStyle}
              />
              <button
                type="button"
                onClick={flipCamera}
                disabled={!ready || capturing}
                aria-label="Switch camera"
                className="absolute right-3 top-3 z-10 flex min-h-11 items-center gap-1.5 rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm disabled:opacity-50"
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
        {snapshotUrl ? (
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
            disabled={disabled || !ready || capturing}
            onClick={() => void capturePhoto()}
          >
            <Camera className="size-5" />
            {capturing ? 'Capturing…' : 'Take photo'}
          </LiveAccentButton>
        )}
      </div>
    </div>,
    document.body,
  )
}
