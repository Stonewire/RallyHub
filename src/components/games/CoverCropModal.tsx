import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NeoButton } from '@/components/neo-minimal'
import {
  COVER_ASPECT,
  COVER_EXPORT_WIDTH,
  COVER_SIZE_HINT,
  type PendingCover,
} from '@/lib/cover-image'

const MAX_ZOOM = 4
/** Display width of the framing box; height follows the aspect. */
const FRAME_W = 520

type CoverCropModalProps = {
  /** A data URL rather than an object URL: nothing to revoke, nothing to expire. */
  cover: PendingCover | null
  onCancel: () => void
  onCropped: (file: File) => void
}

export function CoverCropModal({ cover, onCancel, onCropped }: CoverCropModalProps) {
  const { t } = useTranslation('admin')
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const src = cover?.src ?? null

  const frameH = FRAME_W / COVER_ASPECT
  // Scale at which the image exactly covers the frame — zoom multiplies it.
  const baseScale = natural
    ? Math.max(FRAME_W / natural.w, frameH / natural.h)
    : 1
  const dispW = natural ? natural.w * baseScale * zoom : 0
  const dispH = natural ? natural.h * baseScale * zoom : 0

  /** Keeps the frame inside the image, so no blank edges can be saved. */
  function clampAt(atZoom: number, next: { x: number; y: number }) {
    const w = natural ? natural.w * baseScale * atZoom : 0
    const h = natural ? natural.h * baseScale * atZoom : 0
    const maxX = Math.max(0, (w - FRAME_W) / 2)
    const maxY = Math.max(0, (h - frameH) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }

  async function save() {
    if (!src || !natural || !cover) return
    setBusy(true)
    try {
      const img = new Image()
      img.src = src
      await img.decode()

      const left = FRAME_W / 2 - dispW / 2 + offset.x
      const top = frameH / 2 - dispH / 2 + offset.y
      const perPixel = baseScale * zoom
      const canvas = document.createElement('canvas')
      canvas.width = COVER_EXPORT_WIDTH
      canvas.height = COVER_EXPORT_WIDTH / COVER_ASPECT
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(
        img,
        -left / perPixel,
        -top / perPixel,
        FRAME_W / perPixel,
        frameH / perPixel,
        0,
        0,
        canvas.width,
        canvas.height,
      )
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      )
      if (!blob) return
      const name = cover.name.replace(/\.[^.]+$/, '') || 'cover'
      onCropped(new File([blob], `${name}-cover.jpg`, { type: 'image/jpeg' }))
    } finally {
      setBusy(false)
    }
  }

  if (!cover) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('games.cover.title')}
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-nm-surface border-border rounded-nm-lg w-full max-w-xl space-y-3 border p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-bold">{t('games.cover.title')}</h2>
        <p className="text-muted-foreground text-xs">
          {t('games.cover.hint', { size: COVER_SIZE_HINT })}
        </p>
        <div
          className="bg-muted relative mx-auto w-full max-w-[520px] cursor-grab touch-none overflow-hidden rounded-lg active:cursor-grabbing"
          style={{ aspectRatio: String(COVER_ASPECT) }}
          onPointerDown={(e) => {
            dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const start = dragRef.current
            if (!start) return
            setOffset(clampAt(zoom, { x: e.clientX - start.x, y: e.clientY - start.y }))
          }}
          onPointerUp={() => {
            dragRef.current = null
          }}
        >
          {src ? (
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) =>
                setNatural({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              className="absolute top-1/2 left-1/2 max-w-none select-none"
              style={{
                width: dispW || undefined,
                height: dispH || undefined,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs font-semibold">{t('games.cover.zoom')}</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              const next = Number(e.target.value)
              setZoom(next)
              setOffset((current) => clampAt(next, current))
            }}
            className="accent-nm-yellow flex-1"
          />
        </div>
        <div className="flex justify-end gap-2">
          <NeoButton type="button" variant="ghost" onClick={onCancel}>
            {t('common:cancel')}
          </NeoButton>
          <NeoButton type="button" disabled={busy || !natural} onClick={() => void save()}>
            {busy ? t('games.cover.saving') : t('games.cover.useCrop')}
          </NeoButton>
        </div>
      </div>
    </div>
  )
}
