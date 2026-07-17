import { Camera, ScanLine, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import { inventoryCodeFromQrValue } from '@/lib/inventory-qr'
import type { IScannerControls } from '@zxing/browser'

type InventoryQrScannerProps = {
  onClose: () => void
  onItemScanned: (publicCode: string) => void
}

function stopVideo(video: HTMLVideoElement | null) {
  const stream = video?.srcObject
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) track.stop()
  }
  if (video) video.srcObject = null
}

export function InventoryQrScanner({
  onClose,
  onItemScanned,
}: InventoryQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const handledRef = useRef(false)
  const [starting, setStarting] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    const video = videoRef.current
    handledRef.current = false

    async function startScanner() {
      try {
        if (!video) throw new Error('Camera preview is unavailable.')
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 500,
        })
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video,
          (result) => {
            if (!result || handledRef.current) return
            const publicCode = inventoryCodeFromQrValue(result.getText())
            if (!publicCode) {
              setError("This isn't a RallyHub inventory QR code. Try another item.")
              return
            }
            handledRef.current = true
            controlsRef.current?.stop()
            stopVideo(videoRef.current)
            onItemScanned(publicCode)
          },
        )
        if (disposed) {
          controls.stop()
          stopVideo(video)
          return
        }
        controlsRef.current = controls
        setStarting(false)
      } catch (reason) {
        if (disposed) return
        setStarting(false)
        const name = reason instanceof DOMException ? reason.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow camera access in your browser and try again.'
            : reason instanceof Error
              ? reason.message
              : 'Could not open the camera.',
        )
      }
    }

    void startScanner()
    return () => {
      disposed = true
      controlsRef.current?.stop()
      controlsRef.current = null
      stopVideo(video)
    }
  }, [onItemScanned])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="experience-scope fixed inset-0 z-[10000] flex flex-col bg-neutral-950 text-white" role="dialog" aria-modal="true" aria-labelledby="inventory-scanner-title">
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <div>
          <h2 id="inventory-scanner-title" className="text-lg font-bold">Scan an item</h2>
          <p className="text-sm text-white/65">Point the camera at its RallyHub QR code.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="text-white hover:bg-white/15" aria-label="Close scanner" onClick={onClose}>
          <X className="size-5" />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video ref={videoRef} className="size-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
          <div className="relative aspect-square w-full max-w-xs rounded-3xl border-4 border-amber-400 shadow-[0_0_0_999px_rgba(0,0,0,0.48)]">
            <ScanLine className="absolute top-1/2 left-1/2 size-16 -translate-x-1/2 -translate-y-1/2 text-amber-300/80" />
          </div>
        </div>
        {starting ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-center">
            <Camera className="size-10 text-amber-300" />
            <p className="font-semibold">Opening camera…</p>
          </div>
        ) : null}
      </div>

      <div className="min-h-24 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
        {error ? <p className="text-sm font-semibold text-amber-300" role="alert">{error}</p> : <p className="text-sm text-white/70">The purchase will not happen until you review and confirm it.</p>}
      </div>
    </div>,
    document.body,
  )
}
