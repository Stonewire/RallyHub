import { useEffect, useRef, useState } from 'react'
import { Video } from 'lucide-react'

import { AccentButton } from '@/components/admin/AccentButton'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/notification-context'
import {
  formatVideoDurationLabel,
  getMaxVideoDurationSeconds,
} from '@/lib/live-event'
import type { GameConfig } from '@/types/game-config'

type VideoChallengeCaptureProps = {
  config: GameConfig | null | undefined
  disabled?: boolean
  onFileReady: (file: File) => void
}

export function VideoChallengeCapture({
  config,
  disabled,
  onFileReady,
}: VideoChallengeCaptureProps) {
  const { notify } = useNotification()
  const maxSec = getMaxVideoDurationSeconds(config)
  const fileRef = useRef<HTMLInputElement>(null)
  const [recording, setRecording] = useState(false)
  const [remaining, setRemaining] = useState(maxSec)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      stopRecording(false)
    }
  }, [])

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

  function stopRecording(save: boolean) {
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
    recorderRef.current?.stop()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setRecording(false)
    setRemaining(maxSec)
    if (!save) chunksRef.current = []
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      fileRef.current?.click()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        chunksRef.current = []
        if (blob.size > 0) {
          const file = new File([blob], `recording-${Date.now()}.webm`, {
            type: blob.type,
          })
          void handleFileInput(file)
        }
      }
      recorder.start(200)
      setRecording(true)
      setRemaining(maxSec)
      const started = Date.now()
      tickRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000)
        const left = Math.max(0, maxSec - elapsed)
        setRemaining(left)
        if (left <= 0) {
          stopRecording(true)
        }
      }, 200)
    } catch {
      notify('Could not access camera — use upload instead')
      fileRef.current?.click()
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-medium text-[#FFCB03]">
        Max video length: {formatVideoDurationLabel(maxSec)}
      </p>
      {recording ? (
        <div className="space-y-3 rounded-xl bg-black/40 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-white/70">Recording</p>
          <p className="font-mono text-4xl tabular-nums text-white">
            {remaining}s
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full border-white/30 bg-white/10 text-white"
            onClick={() => stopRecording(true)}
          >
            Stop recording
          </Button>
        </div>
      ) : (
        <>
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
          <AccentButton
            type="button"
            className="w-full"
            disabled={disabled}
            onClick={() => void startRecording()}
          >
            <Video className="size-4" />
            Record video
          </AccentButton>
          <Button
            type="button"
            variant="outline"
            className="w-full border-white/30 bg-white/10 text-white"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            Upload video
          </Button>
        </>
      )}
    </div>
  )
}
