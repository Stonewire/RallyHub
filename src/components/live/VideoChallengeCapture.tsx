import { useEffect, useRef, useState } from 'react'
import { SwitchCamera, Video } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/notification-context'
import {
  formatVideoDurationLabel,
  getMaxVideoDurationSeconds,
} from '@/lib/live-event'
import { getTeamMediaStream } from '@/lib/media-permissions'
import { playVideoStartSound, playVideoStopSound } from '@/lib/sounds'
import { pickVideoRecorderMime, videoFileExtension } from '@/lib/video-recorder'
import type { GameConfig } from '@/types/game-config'

type VideoChallengeCaptureProps = {
  config: GameConfig | null | undefined
  accentColor: string
  disabled?: boolean
  onFileReady: (file: File) => void
}

export function VideoChallengeCapture({
  config,
  accentColor,
  disabled,
  onFileReady,
}: VideoChallengeCaptureProps) {
  const { notify } = useNotification()
  const maxSec = getMaxVideoDurationSeconds(config)
  const fileRef = useRef<HTMLInputElement>(null)
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
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

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
    void openPreview()
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
  }, [previewReady, recording, recordedFile])

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
  }

  async function openPreview(facing: 'environment' | 'user' = facingMode) {
    const stream = await getTeamMediaStream({
      video: { facingMode: facing },
      audio: true,
    })
    if (!stream) {
      notify('Camera access not granted — allow camera when the app opens, or upload a video')
      return
    }
    streamRef.current = stream
    setPreviewReady(true)
  }

  function flipCamera() {
    if (recording) return
    const next = facingMode === 'environment' ? 'user' : 'environment'
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
      vid.onerror = () => resolve(true)
      vid.src = URL.createObjectURL(file)
    })
  }

  async function queueForReview(file: File) {
    const ok = await validateDuration(file)
    if (ok) {
      stopStream()
      setRecordedFile(file)
      setRemaining(maxSec)
    }
  }

  function startRecording() {
    if (!streamRef.current) {
      fileRef.current?.click()
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
          void openPreview()
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

  function discardRecording() {
    setRecordedFile(null)
    setRemaining(maxSec)
    void openPreview()
  }

  if (recordedFile && reviewUrl) {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm font-medium" style={{ color: accentColor }}>
          Review your recording
        </p>
        <div className="xp-media-frame overflow-hidden rounded-xl bg-black">
          <video
            ref={reviewRef}
            key={reviewUrl}
            controls
            playsInline
            preload="auto"
            className="aspect-[4/3] w-full bg-black object-contain"
          >
            <source src={reviewUrl} type={recordedFile.type || undefined} />
          </video>
          <div className="flex gap-2 p-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-white/30 bg-white/10 text-white"
              onClick={discardRecording}
            >
              Retake
            </Button>
            <LiveAccentButton
              type="button"
              className="flex-1"
              accentColor={accentColor}
              disabled={disabled}
              onClick={() => onFileReady(recordedFile)}
            >
              Use this video
            </LiveAccentButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-medium" style={{ color: accentColor }}>
        Max video length: {formatVideoDurationLabel(maxSec)}
      </p>
      <div className="xp-media-frame overflow-hidden rounded-xl bg-black">
        <div className="relative">
          <video
            ref={previewRef}
            autoPlay
            playsInline
            muted
            className="aspect-[4/3] w-full bg-black object-cover"
          />
          {previewReady && !recording ? (
            <button
              type="button"
              onClick={flipCamera}
              aria-label="Switch camera"
              className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
            >
              <SwitchCamera className="size-4" />
              Flip
            </button>
          ) : null}
        </div>
        {recording ? (
          <div className="space-y-2 border-t border-white/10 px-4 py-3 text-center">
            <p className="text-xs uppercase tracking-wide text-white/70">Recording</p>
            <p className="font-mono text-4xl tabular-nums text-white">{remaining}s</p>
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/30 bg-white/10 text-white"
              onClick={() => recorderRef.current?.stop()}
            >
              Stop recording
            </Button>
          </div>
        ) : previewReady ? (
          <div className="space-y-2 p-3">
            <LiveAccentButton
              type="button"
              className="w-full"
              accentColor={accentColor}
              disabled={disabled}
              onClick={() => startRecording()}
            >
              <Video className="size-4" />
              Record video
            </LiveAccentButton>
          </div>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void queueForReview(f)
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full border-white/30 bg-white/10 text-white"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
      >
        Upload video
      </Button>
    </div>
  )
}
