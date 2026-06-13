import { useEffect, useState } from 'react'

import { ChallengeCaptureBriefing } from '@/components/live/ChallengeCaptureBriefing'
import { PhotoChallengeCapture } from '@/components/live/PhotoChallengeCapture'
import { VideoChallengeCapture } from '@/components/live/VideoChallengeCapture'
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
  const [captureOpen, setCaptureOpen] = useState(false)

  useEffect(() => {
    onCaptureActiveChange?.(captureOpen)
  }, [captureOpen, onCaptureActiveChange])

  useEffect(() => {
    return () => onCaptureActiveChange?.(false)
  }, [onCaptureActiveChange])

  function closeCapture() {
    setCaptureOpen(false)
  }

  function handleFileReady(file: File) {
    onFileReady(file)
    setCaptureOpen(false)
  }

  return (
    <>
      <ChallengeCaptureBriefing
        title={title}
        description={description}
        pointsLabel={pointsLabel}
        coverUrl={coverUrl}
        accentColor={accentColor}
        mediaType={mediaType}
        disabled={disabled}
        onStart={() => setCaptureOpen(true)}
      />
      {captureOpen && mediaType === 'photo' ? (
        <PhotoChallengeCapture
          accentColor={accentColor}
          disabled={disabled}
          onClose={closeCapture}
          onFileReady={handleFileReady}
        />
      ) : null}
      {captureOpen && mediaType === 'video' ? (
        <VideoChallengeCapture
          config={config}
          accentColor={accentColor}
          disabled={disabled}
          onClose={closeCapture}
          onFileReady={handleFileReady}
        />
      ) : null}
    </>
  )
}
