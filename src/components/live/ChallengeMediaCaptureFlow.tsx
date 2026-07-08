import { useEffect, useRef, useState } from 'react'

import { ChallengeCaptureBriefing } from '@/components/live/ChallengeCaptureBriefing'
import { ChallengeNativePreview } from '@/components/live/ChallengeNativePreview'
import { PhotoChallengeCapture } from '@/components/live/PhotoChallengeCapture'
import { VideoChallengeCapture } from '@/components/live/VideoChallengeCapture'
import { useNotification } from '@/contexts/notification-context'
import {
  shouldUseNativePhotoCapture,
  shouldUseNativeVideoCapture,
} from '@/lib/capture-platform'
import { downscalePhoto } from '@/lib/challenge-camera'
import {
  formatVideoDurationLabel,
  getMaxVideoDurationSeconds,
} from '@/lib/live-event'
import { validateUploadFileSize } from '@/lib/upload-limits'
import type { GameConfig } from '@/types/game-config'

type ChallengeMediaCaptureFlowProps = {
  title: string
  description?: string | null
  pointsLabel: string
  coverUrl?: string | null
  accentColor: string
  mediaType: 'photo' | 'video'
  config?: GameConfig | null
  disabled?: boolean
  onFileReady: (file: File) => void
  onCaptureActiveChange?: (active: boolean) => void
}

export function ChallengeMediaCaptureFlow({
  title,
  description,
  pointsLabel,
  coverUrl,
  accentColor,
  mediaType,
  config,
  disabled,
  onFileReady,
  onCaptureActiveChange,
}: ChallengeMediaCaptureFlowProps) {
  const { notify } = useNotification()
  const nativeInputRef = useRef<HTMLInputElement>(null)
  const nativePreviewUrlRef = useRef<string | null>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [nativePreviewFile, setNativePreviewFile] = useState<File | null>(null)
  const [nativePreviewUrl, setNativePreviewUrl] = useState<string | null>(null)

  const useNativePhoto = shouldUseNativePhotoCapture()
  const useNativeVideo = shouldUseNativeVideoCapture()
  const useNativeForMedia =
    mediaType === 'photo' ? useNativePhoto : useNativeVideo
  const captureActive = captureOpen || nativePreviewFile !== null

  useEffect(() => {
    onCaptureActiveChange?.(captureActive)
  }, [captureActive, onCaptureActiveChange])

  useEffect(() => {
    return () => {
      onCaptureActiveChange?.(false)
      revokeNativePreviewUrl()
    }
  }, [onCaptureActiveChange])

  function revokeNativePreviewUrl() {
    if (nativePreviewUrlRef.current) {
      URL.revokeObjectURL(nativePreviewUrlRef.current)
      nativePreviewUrlRef.current = null
    }
  }

  function clearNativePreview() {
    revokeNativePreviewUrl()
    setNativePreviewFile(null)
    setNativePreviewUrl(null)
  }

  function openNativeCamera() {
    nativeInputRef.current?.click()
  }

  function validateVideoDuration(file: File): Promise<boolean> {
    const maxSec = getMaxVideoDurationSeconds(config)
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

  async function handleNativeFile(file: File) {
    const kind = mediaType === 'photo' ? 'photo' : 'video'
    const sizeError = validateUploadFileSize(file, kind)
    if (sizeError) {
      notify(sizeError)
      return
    }

    if (mediaType === 'video') {
      const ok = await validateVideoDuration(file)
      if (!ok) return
    }

    // The OS camera app (native capture) hands back full-resolution photos,
    // often several MB on modern phones — downscale before it ever reaches
    // the preview/upload path, same as the in-app capture flow already does.
    const readyFile =
      mediaType === 'photo'
        ? await downscalePhoto(file).then(
            (blob) => new File([blob], file.name, { type: blob.type || file.type }),
          )
        : file

    revokeNativePreviewUrl()
    const url = URL.createObjectURL(readyFile)
    nativePreviewUrlRef.current = url
    setNativePreviewFile(readyFile)
    setNativePreviewUrl(url)
  }

  function handleBriefingStart() {
    if (useNativeForMedia) {
      openNativeCamera()
      return
    }
    setCaptureOpen(true)
  }

  function closeInAppCapture() {
    setCaptureOpen(false)
  }

  function handleInAppFileReady(file: File) {
    onFileReady(file)
    setCaptureOpen(false)
  }

  function handleNativeRetake() {
    clearNativePreview()
    openNativeCamera()
  }

  function handleNativeClose() {
    clearNativePreview()
  }

  function handleNativeSubmit() {
    if (!nativePreviewFile) return
    onFileReady(nativePreviewFile)
  }

  const nativeAccept =
    mediaType === 'photo' ? 'image/*' : 'video/quicktime,video/mp4,video/*'

  return (
    <>
      {useNativeForMedia ? (
        <input
          ref={nativeInputRef}
          type="file"
          accept={nativeAccept}
          {...(mediaType === 'photo'
            ? { capture: 'environment' as const }
            : { capture: true })}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void handleNativeFile(f)
          }}
        />
      ) : null}

      <ChallengeCaptureBriefing
        title={title}
        description={description}
        pointsLabel={pointsLabel}
        coverUrl={coverUrl}
        accentColor={accentColor}
        mediaType={mediaType}
        disabled={disabled}
        onStart={handleBriefingStart}
      />

      {nativePreviewFile && nativePreviewUrl ? (
        <ChallengeNativePreview
          mediaType={mediaType}
          previewUrl={nativePreviewUrl}
          accentColor={accentColor}
          disabled={disabled}
          onRetake={handleNativeRetake}
          onSubmit={handleNativeSubmit}
          onClose={handleNativeClose}
        />
      ) : null}

      {!useNativeForMedia && captureOpen && mediaType === 'photo' ? (
        <PhotoChallengeCapture
          accentColor={accentColor}
          disabled={disabled}
          onClose={closeInAppCapture}
          onFileReady={handleInAppFileReady}
        />
      ) : null}
      {!useNativeForMedia && captureOpen && mediaType === 'video' ? (
        <VideoChallengeCapture
          config={config}
          accentColor={accentColor}
          disabled={disabled}
          onClose={closeInAppCapture}
          onFileReady={handleInAppFileReady}
        />
      ) : null}
    </>
  )
}
