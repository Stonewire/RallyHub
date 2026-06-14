import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SwitchCamera, Video, X } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/notification-context'
import {
  CHALLENGE_PREVIEW_MEDIA_CLASS,
  getChallengeCameraStream,
  previewVideoStyle,
  streamNeedsQuarterTurn,
  type ChallengeFacingMode,
} from '@/lib/challenge-camera'
import {
  formatVideoDurationLabel,
  getMaxVideoDurationSeconds,
} from '@/lib/live-event'
import { playVideoStartSound, playVideoStopSound } from '@/lib/sounds'
import { validateUploadFileSize } from '@/lib/upload-limits'
import { pickVideoRecorderMime, videoFileExtension } from '@/lib/video-recorder'
import type { GameConfig } from '@/types/game-config'

type VideoChallengeCaptureProps = {
  config: GameConfig | null | undefined
  accentColor: string
  disabled?: boolean
  onClose: () => void
  onFileReady: (file: File) => void
}

export function VideoChallengeCapture({
  config,
  accentColor,
  disabled,
  onClose,
  onFileReady,
}: VideoChallengeCaptureProps) {
  const { notify } = useNotification()
  const maxSec = getMaxVideoDurationSeconds(config)
  const uploadRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const reviewRef = useRef<HTMLVideoElement>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordedFile, setRecordedFile] = useState<File | null>(null)
  const [reviewUrl, setReviewUrl] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(maxSec)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickRef = useRef<number | undefined>(undefined)
  const [facingMode, setFacingMode] = useState<ChallengeFacingMode>('environment')
  const [quarterTurn, setQuarterTurn] = useState(false)

  useEffect(() => {
    if (!recordedFile) {
      setReviewUrl(null)
      return
    }
    const url = URL.createObjectURL(recordedFile)
    setReviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [recordedFile])

  useEffect(() => {
    if (!reviewUrl || !reviewRef.current) return
    const el = reviewRef.current
    el.src = reviewUrl
    el.load()
    void el.play().catch(() => {})
  }, [reviewUrl])

  useEffect(() => {
    if (recordedFile) return
    void openPreview(facingMode)
    return () => {
      stopStream()
    }
  }, [recordedFile])

  useEffect(() => {
    if (recordedFile) return
    const el = previewRef.current
    if (!el || !streamRef.current) return
    el.muted = true
    el.playsInline = true
    el.setAttribute('playsinline', 'true')
    el.srcObject = streamRef.current
    void el.play().catch(() => {})
  }, [previewReady, recording, recordedFile, quarterTurn, facingMode])

  function stopStream() {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = undefined
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (previewRef.current) previewRef.current.srcObject = null
    setPreviewReady(false)
    setRecording(false)
    setQuarterTurn(false)
  }

  async function openPreview(facing: ChallengeFacingMode) {
    const stream = await getChallengeCameraStream(facing, true)
    if (!stream) {
      notify('Camera access not granted — allow camera when the app opens, or upload a video')
      return
    }
    streamRef.current = stream
    setQuarterTurn(streamNeedsQuarterTurn(stream))
    setPreviewReady(true)
  }

  function flipCamera() {
    if (recording) return
    const next: ChallengeFacingMode =
      facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    stopStream()
    void openPreview(next)
  }

  function validateDuration(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const vid = document.createElement('video')
      vid.preload = 'metadata'
      vid.onloadedmetadata = () => {
        URL.revokeObjectURL(vid.src)
        if (vid.duration > maxSec + 0.5) {
          notify(`Video must be ${formatVideoDurationLabel(maxSec)} or less`)
          resolve(false)
        } else {
          resolve(true)
        }
      }
      vid.onerror = () => {
        URL.revokeObjectURL(vid.src)
        notify('Could not read video — try a different file')
        resolve(false)
      }
      vid.src = URL.createObjectURL(file)
    })
  }

  async function queueForReview(file: File) {
    const sizeError = validateUploadFileSize(file, 'video')
    if (sizeError) {
      notify(sizeError)
      return
    }
    const ok = await validateDuration(file)
    if (ok) {
      stopStream()
      setRecordedFile(file)
      setRemaining(maxSec)
    }
  }

  function startRecording() {
    if (!streamRef.current) {
      uploadRef.current?.click()
      return
    }
    try {
      const mime = pickVideoRecorderMime()
      const recorder = new MediaRecorder(streamRef.current, { mimeType: mime })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        playVideoStopSound()
        const blob = new Blob(chunksRef.current, { type: mime })
        chunksRef.current = []
        stopStream()
        if (blob.size > 0) {
          const ext = videoFileExtension(mime)
          void queueForReview(
            new File([blob], `recording-${Date.now()}.${ext}`, { type: mime }),
          )
        } else {
          void openPreview(facingMode)
        }
      }
      recorder.start(200)
      playVideoStartSound()
      setRecording(true)
      const started = Date.now()
      tickRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000)
        const left = Math.max(0, maxSec - elapsed)
        setRemaining(left)
        if (left <= 0) recorderRef.current?.stop()
      }, 200)
    } catch {
      notify('Could not start recording')
    }
  }

  function retake() {
    setRecordedFile(null)
    setRemaining(maxSec)
    void openPreview(facingMode)
  }

  function cancelCapture() {
    stopStream()
    setRecordedFile(null)
    setRemaining(maxSec)
    onClose()
  }

  function submitVideo() {
    if (!recordedFile) return
    onFileReady(recordedFile)
  }

  const livePreviewStyle = previewVideoStyle(facingMode, quarterTurn)

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="experience-scope fixed inset-0 z-[10000] flex flex-col bg-black">
      <div
        className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        {!recordedFile ? (
          <p className="text-sm font-medium text-white/80">
            Max length: {formatVideoDurationLabel(maxSec)}
          </p>
        ) : (
          <span />
        )}
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
        <div className="xp-media-frame mx-auto flex w-full max-w-lg flex-col items-center justify-center bg-black">
          {recordedFile && reviewUrl ? (
            <video
              ref={reviewRef}
              key={reviewUrl}
              controls
              playsInline
              preload="auto"
              className={CHALLENGE_PREVIEW_MEDIA_CLASS}
            >
              <source src={reviewUrl} type={recordedFile.type || undefined} />
            </video>
          ) : (
            <div className="relative flex w-full items-center justify-center">
              <video
                ref={previewRef}
                autoPlay
                playsInline
                muted
                className={CHALLENGE_PREVIEW_MEDIA_CLASS}
                style={livePreviewStyle}
              />
              {previewReady && !recording ? (
                <button
                  type="button"
                  onClick={flipCamera}
                  aria-label="Switch camera"
                  className="absolute right-3 top-3 z-10 flex min-h-11 items-center gap-1.5 rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm"
                >
                  <SwitchCamera className="size-4" />
                  Flip
                </button>
              ) : null}
            </div>
          )}
          {recording ? (
            <div className="space-y-2 border-t border-white/10 px-4 py-4 text-center">
              <p className="text-xs uppercase tracking-wide text-white/70">Recording</p>
              <p className="font-mono text-4xl tabular-nums text-white">{remaining}s</p>
              <Button
                type="button"
                variant="outline"
                className="min-h-12 w-full border-white/30 bg-white/10 text-base text-white"
                onClick={() => recorderRef.current?.stop()}
              >
                Stop recording
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="shrink-0 space-y-3 px-4 pt-3"
        style={{
          paddingBottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 3.5rem))',
        }}
      >
        {recordedFile && reviewUrl ? (
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
              onClick={submitVideo}
            >
              Submit
            </LiveAccentButton>
          </div>
        ) : !recording && previewReady ? (
          <LiveAccentButton
            type="button"
            className="mx-auto min-h-12 w-full max-w-lg gap-2 text-base"
            accentColor={accentColor}
            disabled={disabled}
            onClick={() => startRecording()}
          >
            <Video className="size-5" />
            Record video
          </LiveAccentButton>
        ) : null}
        {!recordedFile && !recording ? (
          <Button
            type="button"
            variant="outline"
            className="mx-auto min-h-12 w-full max-w-lg border-white/30 bg-white/10 text-base text-white"
            disabled={disabled}
            onClick={() => uploadRef.current?.click()}
          >
            Upload video
          </Button>
        ) : null}
      </div>

      <input
        ref={uploadRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void queueForReview(f)
        }}
      />
    </div>,
    document.body,
  )
}
