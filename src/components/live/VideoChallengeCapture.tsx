import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SwitchCamera, Video, X } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/notification-context'
import {
  CHALLENGE_CAPTURE_FRAME_CLASS,
  CHALLENGE_VIDEO_LIVE_PREVIEW_CLASS,
  CHALLENGE_VIDEO_MEDIA_CONTAIN_CLASS,
  getChallengeCameraStream,
  previewVideoStyle,
  streamNeedsQuarterTurn,
  type ChallengeFacingMode,
} from '@/lib/challenge-camera'
import { nowMs, reportClientIssue, reportClientTiming } from '@/lib/client-diagnostics'
import {
  formatVideoDurationLabel,
  getMaxVideoDurationSeconds,
} from '@/lib/live-event'
import { playVideoStartSound, playVideoStopSound } from '@/lib/sounds'
import { validateUploadFileSize } from '@/lib/upload-limits'
import {
  computeVideoBitsPerSecond,
  createVideoRecorder,
  videoFileExtension,
  videoMimeForRecorder,
} from '@/lib/video-recorder'
import type { GameConfig } from '@/types/game-config'

type VideoChallengeCaptureProps = {
  config: GameConfig | null | undefined
  accentColor: string
  disabled?: boolean
  eventId: string
  onClose: () => void
  onFileReady: (file: File) => void
}

export function VideoChallengeCapture({
  config,
  accentColor,
  disabled,
  eventId,
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the preview when the recording is removed
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flipCamera() explicitly restarts the stream on facingMode change, so re-running this effect too would restart it twice
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

  // Choppiness investigation: count real preview frames while recording via
  // requestVideoFrameCallback, so "very choppy" becomes a measured fps instead
  // of an adjective. Finished (idempotently) before the stream is torn down.
  const frameStatsRef = useRef<{ frames: number; startedAt: number; stop: (() => void) | null }>({
    frames: 0,
    startedAt: 0,
    stop: null,
  })
  const measuredFpsRef = useRef<number | null>(null)

  function startPreviewFrameCount() {
    const el = previewRef.current as
      | (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number })
      | null
    measuredFpsRef.current = null
    if (!el?.requestVideoFrameCallback) {
      frameStatsRef.current = { frames: 0, startedAt: 0, stop: null }
      return
    }
    let live = true
    frameStatsRef.current = { frames: 0, startedAt: nowMs(), stop: () => (live = false) }
    const tick = () => {
      if (!live) return
      frameStatsRef.current.frames += 1
      el.requestVideoFrameCallback!(tick)
    }
    el.requestVideoFrameCallback(tick)
  }

  function finishPreviewFrameCount(): number | null {
    const stats = frameStatsRef.current
    if (!stats.stop) return measuredFpsRef.current
    stats.stop()
    stats.stop = null
    const elapsed = nowMs() - stats.startedAt
    measuredFpsRef.current =
      elapsed >= 500 && stats.frames > 0 ? Math.round((stats.frames / elapsed) * 1000) : null
    return measuredFpsRef.current
  }

  function stopStream() {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = undefined
    }
    finishPreviewFrameCount()
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
      // Snapshot what the camera actually negotiated while the track is live;
      // after stopStream() getSettings() comes back empty.
      const trackSettings = streamRef.current.getVideoTracks()[0]?.getSettings() ?? {}
      const recStartedAt = nowMs()

      const recorder = createVideoRecorder(streamRef.current, maxSec)
      const mime = videoMimeForRecorder(recorder)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        playVideoStopSound()
        const blob = new Blob(chunksRef.current, { type: mime })
        chunksRef.current = []
        const measuredFps = finishPreviewFrameCount()
        stopStream()

        const durationMs = Math.round(nowMs() - recStartedAt)
        const trackArea = (trackSettings.width ?? 0) * (trackSettings.height ?? 0)
        const choppy = measuredFps !== null && measuredFps < 24
        const overSized = trackArea > 2_400_000 // beyond 1080x1920
        if (durationMs >= 1500 && (choppy || overSized || measuredFps === null)) {
          reportClientTiming(
            'record-timing',
            `video preview ${measuredFps ?? '?'}fps at ${trackSettings.width ?? '?'}x${trackSettings.height ?? '?'}`,
            {
              eventId,
              extra: {
                measuredFps,
                trackWidth: trackSettings.width ?? null,
                trackHeight: trackSettings.height ?? null,
                trackFps: trackSettings.frameRate ?? null,
                mime,
                requestedBps: computeVideoBitsPerSecond(
                  trackSettings.width ?? 1920,
                  trackSettings.height ?? 1080,
                  maxSec,
                ),
                durationMs,
                blobBytes: blob.size,
              },
            },
          )
        }

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
      startPreviewFrameCount()
      const started = Date.now()
      tickRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000)
        const left = Math.max(0, maxSec - elapsed)
        setRemaining(left)
        if (left <= 0) recorderRef.current?.stop()
      }, 200)
    } catch (err) {
      const detail = reportClientIssue('video-record', err, { eventId })
      notify(`Could not start recording (${detail})`)
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

      <div className="flex min-h-0 flex-1">
        <div className={CHALLENGE_CAPTURE_FRAME_CLASS}>
          {recordedFile && reviewUrl ? (
            <video
              ref={reviewRef}
              key={reviewUrl}
              controls
              playsInline
              preload="auto"
              className={CHALLENGE_VIDEO_MEDIA_CONTAIN_CLASS}
            >
              <source src={reviewUrl} type={recordedFile.type || undefined} />
            </video>
          ) : (
            <>
              <video
                ref={previewRef}
                autoPlay
                playsInline
                muted
                className={CHALLENGE_VIDEO_LIVE_PREVIEW_CLASS}
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
              {recording ? (
                <div className="absolute inset-x-0 bottom-0 space-y-2 bg-black/60 px-4 py-4 text-center backdrop-blur-sm">
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
            </>
          )}
        </div>
      </div>

      <div
        className="flex shrink-0 flex-col items-center space-y-3 px-4 pt-3"
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
