import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Video, X } from 'lucide-react'

import { LiveAccentButton } from '@/components/live/LiveAccentButton'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/contexts/notification-context'
import { CHALLENGE_PREVIEW_MEDIA_CLASS } from '@/lib/challenge-camera'
import { playShutterSound } from '@/lib/sounds'
import { validateUploadFileSize } from '@/lib/upload-limits'

type ChallengeNativeCaptureProps = {
  mediaType: 'photo' | 'video'
  accentColor: string
  disabled?: boolean
  onClose: () => void
  onFileReady: (file: File) => void
  /** Optional extra validation before accepting a video file (e.g. duration). */
  validateVideoFile?: (file: File) => Promise<boolean>
  maxLengthLabel?: string
}

export function ChallengeNativeCapture({
  mediaType,
  accentColor,
  disabled,
  onClose,
  onFileReady,
  validateVideoFile,
  maxLengthLabel,
}: ChallengeNativeCaptureProps) {
  const { notify } = useNotification()
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [opening, setOpening] = useState(false)

  const isPhoto = mediaType === 'photo'
  const accept = isPhoto ? 'image/*' : 'video/*'

  function revokePreviewUrl() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  useEffect(() => {
    return () => revokePreviewUrl()
  }, [])

  function openNativeCamera() {
    if (opening) return
    setOpening(true)
    inputRef.current?.click()
    window.setTimeout(() => setOpening(false), 500)
  }

  async function handleNativeFile(file: File) {
    const kind = isPhoto ? 'photo' : 'video'
    const sizeError = validateUploadFileSize(file, kind)
    if (sizeError) {
      notify(sizeError)
      return
    }

    if (!isPhoto && validateVideoFile) {
      const ok = await validateVideoFile(file)
      if (!ok) return
    }

    if (isPhoto) playShutterSound()

    revokePreviewUrl()
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setPreviewFile(file)
    setPreviewUrl(url)
  }

  function retake() {
    revokePreviewUrl()
    setPreviewUrl(null)
    setPreviewFile(null)
    openNativeCamera()
  }

  function cancelCapture() {
    revokePreviewUrl()
    setPreviewUrl(null)
    setPreviewFile(null)
    onClose()
  }

  function submit() {
    if (!previewFile) return
    onFileReady(previewFile)
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="experience-scope fixed inset-0 z-[10000] flex flex-col bg-black">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void handleNativeFile(f)
        }}
      />

      <div
        className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        {!isPhoto && maxLengthLabel && !previewUrl ? (
          <p className="text-sm font-medium text-white/80">Max length: {maxLengthLabel}</p>
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
        <div className="xp-media-frame mx-auto flex w-full max-w-lg items-center justify-center bg-black">
          {previewUrl ? (
            isPhoto ? (
              <img
                src={previewUrl}
                alt="Preview"
                className={CHALLENGE_PREVIEW_MEDIA_CLASS}
              />
            ) : (
              <video
                src={previewUrl}
                controls
                playsInline
                className={CHALLENGE_PREVIEW_MEDIA_CLASS}
              />
            )
          ) : (
            <p className="px-4 py-12 text-center text-sm text-white/70">
              {isPhoto
                ? 'Use your device camera for the best photo quality.'
                : 'Use your device camera to record a video.'}
            </p>
          )}
        </div>
      </div>

      <div
        className="shrink-0 space-y-3 px-4 pt-3"
        style={{
          paddingBottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 3.5rem))',
        }}
      >
        {previewUrl ? (
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
              onClick={submit}
            >
              Submit
            </LiveAccentButton>
          </div>
        ) : (
          <LiveAccentButton
            type="button"
            className="mx-auto min-h-12 w-full max-w-lg gap-2 text-base"
            accentColor={accentColor}
            disabled={disabled || opening}
            onClick={openNativeCamera}
          >
            {isPhoto ? <Camera className="size-5" /> : <Video className="size-5" />}
            {isPhoto ? 'Take photo' : 'Record video'}
          </LiveAccentButton>
        )}
      </div>
    </div>,
    document.body,
  )
}
