import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, SwitchCamera, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/notification-context'
import { cameraPermissionDenied } from '@/lib/media-permissions'
import {
  CHALLENGE_ASPECT_FRAME_CLASS,
  CHALLENGE_ASPECT_TRUE_MEDIA_CLASS,
  captureStillFrame,
  encodeCanvasToJpeg,
  getChallengeCameraStream,
  onOrientationFlip,
  previewVideoStyle,
  type ChallengeFacingMode,
} from '@/lib/challenge-camera'
import { nowMs, reportClientIssue, reportClientTiming } from '@/lib/client-diagnostics'

type PhotoChallengeCaptureProps = {
  accentColor: string
  disabled?: boolean
  eventId: string
  onClose: () => void
  onFileReady: (file: File) => void
}

export function PhotoChallengeCapture({
  accentColor,
  disabled,
  eventId,
  onClose,
  onFileReady,
}: PhotoChallengeCaptureProps) {
  const { t } = useTranslation('live')
  const { notify } = useNotification()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // The captured frame lives as a canvas element appended into this host:
  // showing pixels needs no JPEG, so the snapshot appears the same frame the
  // shutter is pressed even when Hermit's encoder stalls (see challenge-camera).
  const snapshotHostRef = useRef<HTMLDivElement>(null)
  const encodePromiseRef = useRef<Promise<Blob> | null>(null)
  const encodeSeqRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [snapshotTaken, setSnapshotTaken] = useState(false)
  const [encodePending, setEncodePending] = useState(false)
  const [facingMode, setFacingMode] = useState<ChallengeFacingMode>('environment')
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(undefined)

  function clearSnapshot() {
    encodeSeqRef.current += 1
    encodePromiseRef.current = null
    snapshotHostRef.current?.replaceChildren()
    setSnapshotTaken(false)
    setEncodePending(false)
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap using the initial facingMode; flipCamera() explicitly restarts the stream on change, so re-running this effect too would restart it twice
  }, [])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !streamRef.current || snapshotTaken) return
    el.srcObject = streamRef.current
    void el.play().catch(() => {})
  }, [ready, snapshotTaken, facingMode])

  const cameraOpenMsRef = useRef<number | null>(null)

  async function startCamera(facing: ChallengeFacingMode, deviceId?: string) {
    stopStream()
    const openStarted = nowMs()
    const stream = await getChallengeCameraStream(facing, false, deviceId, eventId)
    if (!stream) {
      notify(
        (await cameraPermissionDenied())
          ? t('join.capture.cameraBlocked')
          : t('join.photo.cameraDidNotOpen'),
      )
      return
    }
    cameraOpenMsRef.current = Math.round(nowMs() - openStarted)
    streamRef.current = stream
    setReady(true)
    setActiveDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId)
  }

  function flipCamera() {
    const next: ChallengeFacingMode =
      facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    setActiveDeviceId(undefined)
    clearSnapshot()
    void startCamera(next)
  }

  // Rotating the device changes which way the sensor should be asked to frame,
  // so the stream is reopened with orientation-correct constraints. Not while
  // reviewing a shot: the snapshot must stay exactly as taken.
  useEffect(() => {
    const onRotate = () => {
      if (snapshotTaken || !streamRef.current) return
      void startCamera(facingMode, activeDeviceId)
    }
    return onOrientationFlip(onRotate)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startCamera is stable per render; the listener reads current state
  }, [snapshotTaken, facingMode, activeDeviceId])

  function capturePhoto() {
    const video = videoRef.current
    if (!streamRef.current || !video || snapshotTaken) return
    try {
      const shutterPressed = nowMs()
      const canvas = captureStillFrame(video)
      const drawDone = nowMs()
      // Frame is safely on the canvas: release the camera before anything
      // else so the encoder never fights the live camera pipeline for the GPU.
      stopStream()

      canvas.className = CHALLENGE_ASPECT_TRUE_MEDIA_CLASS
      snapshotHostRef.current?.replaceChildren(canvas)
      setSnapshotTaken(true)

      const drawMs = Math.round(drawDone - shutterPressed)

      // Encode in the background while the participant reviews the shot. A
      // stalled Hermit encode now costs invisible review-time, not shutter-time.
      const seq = ++encodeSeqRef.current
      const encodeStarted = nowMs()
      const promise = encodeCanvasToJpeg(canvas).then((blob) => {
        if (encodeSeqRef.current === seq) {
          const encodeMs = Math.round(nowMs() - encodeStarted)
          if (encodeMs > 600) {
            reportClientTiming('capture-timing', `slow background encode: ${encodeMs}ms`, {
              eventId,
              extra: {
                drawMs,
                encodeMs,
                cameraOpenMs: cameraOpenMsRef.current,
                finalBytes: blob.size,
              },
            })
          }
        }
        return blob
      })
      encodePromiseRef.current = promise
      // Submit owns real error handling; this only prevents an unhandled
      // rejection if the participant retakes before the encode settles.
      promise.catch(() => {})
    } catch (err) {
      const detail = reportClientIssue('photo-capture', err, { eventId })
      notify(t('join.photo.couldNotCapturePhotoDetail', { detail }))
    }
  }

  function retake() {
    clearSnapshot()
    void startCamera(facingMode)
  }

  function cancelCapture() {
    stopStream()
    clearSnapshot()
    onClose()
  }

  function submitPhoto() {
    const promise = encodePromiseRef.current
    if (!promise || encodePending) return
    setEncodePending(true)
    promise
      .then((blob) => {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onFileReady(file)
      })
      .catch(() => notify(t('join.photo.couldNotProcessPhoto')))
      .then(() => setEncodePending(false))
  }

  const livePreviewStyle = previewVideoStyle(facingMode, false)

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
          aria-label={t('join.capture.closeCapture')}
          className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className={CHALLENGE_ASPECT_FRAME_CLASS}>
          {/* Snapshot canvas host: always mounted so the captured canvas can be
              appended synchronously; hidden while the live preview shows. */}
          <div
            ref={snapshotHostRef}
            className={
              snapshotTaken ? 'flex size-full items-center justify-center' : 'hidden'
            }
          />
          {!snapshotTaken ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={CHALLENGE_ASPECT_TRUE_MEDIA_CLASS}
                style={livePreviewStyle}
              />
              <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={flipCamera}
                  disabled={!ready}
                  aria-label={t('join.capture.switchCamera')}
                  className="flex min-h-11 items-center gap-1.5 rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm disabled:opacity-50"
                >
                  <SwitchCamera className="size-4" />
                  {t('join.capture.flip')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div
        className="flex shrink-0 flex-col items-center space-y-3 px-4 pt-3"
        style={{
          paddingBottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 3.5rem))',
        }}
      >
        {snapshotTaken ? (
          <div className="mx-auto flex w-full max-w-lg gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 flex-1 border-white/30 bg-white/10 text-base text-white"
              onClick={retake}
            >
              {t('join.capture.retake')}
            </Button>
            <LiveAccentButton
              type="button"
              className="min-h-12 flex-1 text-base"
              accentColor={accentColor}
              disabled={disabled || encodePending}
              onClick={submitPhoto}
            >
              {encodePending ? t('join.photo.preparing') : t('join.capture.submit')}
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
            {t('join.capture.takePhoto')}
          </LiveAccentButton>
        )}
      </div>
    </div>,
    document.body,
  )
}
