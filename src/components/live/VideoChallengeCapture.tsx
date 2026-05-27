import { useEffect, useRef, useState } from 'react'
import { Video } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/notification-context'
import {
  formatVideoDurationLabel,
  getMaxVideoDurationSeconds,
} from '@/lib/live-event'
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
  const [previewReady, setPreviewReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [remaining, setRemaining] = useState(maxSec)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    void openPreview()
    return () => {
      stopAll(false)
    }
  }, [])

  useEffect(() => {
    const el = previewRef.current
    if (!el || !streamRef.current) return
    el.muted = true
    el.playsInline = true
    el.setAttribute('playsinline', 'true')
    el.srcObject = streamRef.current
    void el.play().catch(() => {})
  }, [previewReady, recording])

  async function openPreview() {
    if (!navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      })
      streamRef.current = stream
      setPreviewReady(true)
    } catch {
      notify('Could not access camera — use upload instead')
    }
  }

  function clearVideoEl() {
    const el = previewRef.current
    if (el) el.srcObject = null
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

  async function handleFileInput(file: File | undefined) {
    if (!file) return
    const ok = await validateDuration(file)
    if (ok) onFileReady(file)
  }

  function stopAll(saveRecording: boolean) {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = undefined
    }
    if (recording) {
      recorderRef.current?.stop()
      recorderRef.current = null
      setRecording(false)
      setRemaining(maxSec)
      if (!saveRecording) chunksRef.current = []
    }
    if (!saveRecording) {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      clearVideoEl()
      setPreviewReady(false)
    }
  }

  function startRecording() {
    if (!streamRef.current) {
      fileRef.current?.click()
      return
    }
    try {
      const recorder = new MediaRecorder(streamRef.current)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        chunksRef.current = []
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        clearVideoEl()
        setPreviewReady(false)
        setRecording(false)
        if (blob.size > 0) {
          const file = new File([blob], `recording-${Date.now()}.webm`, {
            type: blob.type,
          })
          void handleFileInput(file)
        } else {
          void openPreview()
        }
      }
      recorder.start(200)
      setRecording(true)
      const started = Date.now()
      tickRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000)
        const left = Math.max(0, maxSec - elapsed)
        setRemaining(left)
        if (left <= 0) {
          if (tickRef.current) window.clearInterval(tickRef.current)
          recorderRef.current?.stop()
        }
      }, 200)
    } catch {
      notify('Could not start recording')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-medium" style={{ color: accentColor }}>
        Max video length: {formatVideoDurationLabel(maxSec)}
      </p>
      <div className="overflow-hidden rounded-xl bg-black">
        <video
          ref={previewRef}
          autoPlay
          playsInline
          muted
          className="aspect-[4/3] w-full bg-black object-cover"
        />
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
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          void handleFileInput(f)
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
