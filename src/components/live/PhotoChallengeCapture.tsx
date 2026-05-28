import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/notification-context'
import { playShutterSound } from '@/lib/sounds'

type PhotoChallengeCaptureProps = {
  accentColor: string
  disabled?: boolean
  onFileReady: (file: File) => void
}

export function PhotoChallengeCapture({
  accentColor,
  disabled,
  onFileReady,
}: PhotoChallengeCaptureProps) {
  const { notify } = useNotification()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [snapshot, setSnapshot] = useState<string | null>(null)

  useEffect(() => {
    void startCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !streamRef.current || snapshot) return
    el.srcObject = streamRef.current
    void el.play().catch(() => {})
  }, [ready, snapshot])

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      notify('Camera not available in this browser')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      setReady(true)
    } catch {
      notify('Could not access camera')
    }
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
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  function retake() {
    setSnapshot(null)
    void startCamera()
  }

  function usePhoto() {
    if (!snapshot) return
    fetch(snapshot)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onFileReady(file)
      })
      .catch(() => notify('Could not process photo'))
  }

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />
      <div className="overflow-hidden rounded-xl bg-black">
        {snapshot ? (
          <img src={snapshot} alt="Preview" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-[4/3] w-full bg-black object-cover"
          />
        )}
        <div className="space-y-2 p-3">
          {snapshot ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-white/30 bg-white/10 text-white"
                onClick={retake}
              >
                Retake
              </Button>
              <LiveAccentButton
                type="button"
                className="flex-1"
                accentColor={accentColor}
                disabled={disabled}
                onClick={usePhoto}
              >
                Use photo
              </LiveAccentButton>
            </div>
          ) : (
            <LiveAccentButton
              type="button"
              className="w-full"
              accentColor={accentColor}
              disabled={disabled || !ready}
              onClick={capturePhoto}
            >
              <Camera className="size-4" />
              Take photo
            </LiveAccentButton>
          )}
        </div>
      </div>
    </div>
  )
}
