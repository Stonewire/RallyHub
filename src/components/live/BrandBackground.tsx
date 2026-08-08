import { useEffect, type ReactNode } from 'react'

import { brandBlobColors, displayTextClass } from '@/lib/live-event'
import type { TenantPublicOrg } from '@/lib/tenant'
import type { Tables } from '@/types/helpers'

type BrandBackgroundProps = {
  event: Tables<'events'>
  organization: TenantPublicOrg | Tables<'organizations'> | null
  variant?: 'default' | 'disco' | 'relaxed'
  children: ReactNode
  className?: string
  /**
   * Confines the backdrop to this element instead of the viewport, for the
   * preview frames in the event editor. Live surfaces keep the fixed backdrop,
   * which fills the screen without inflating scroll height.
   */
  contained?: boolean
  /**
   * Lets the content stretch to the height of this element, for screens that
   * must fit the viewport exactly rather than scroll (the quiz question).
   */
  fill?: boolean
  /**
   * A 'game'-branded quiz/bingo stage (CF3-16): replaces the blob backdrop
   * with the game's designed background — a full-bleed image or a corner
   * colour gradient. Null keeps the event branding.
   */
  gameBackdrop?: { imageUrl: string | null; colors: string[] | null } | null
}

export function BrandBackground({
  event,
  organization,
  variant = 'default',
  children,
  className,
  contained = false,
  fill = false,
  gameBackdrop = null,
}: BrandBackgroundProps) {
  const { base, primary, accent } = brandBlobColors(event, organization)
  const opacity = variant === 'relaxed' ? 0.4 : variant === 'disco' ? 0.6 : 0.55
  const textTone = displayTextClass(event)

  // iOS rubber-band scrolling shows the page BEHIND the app — a plain white
  // body, which read as "I scrolled past the end into a white screen" (8 Aug
  // test). Paint the body the event's base colour while a live surface is up.
  useEffect(() => {
    if (contained) return
    const previous = document.body.style.backgroundColor
    document.body.style.backgroundColor = base
    return () => {
      document.body.style.backgroundColor = previous
    }
  }, [base, contained])

  return (
    <div className={`experience-scope relative ${textTone} ${className ?? ''}`}>
      {/* Fixed backdrop — fills viewport without inflating scroll height. */}
      <div
        // Contained frames sit on an opaque card, so the backdrop stays at z-0
        // inside the frame rather than behind it, where -z-10 would hide it.
        className={`pointer-events-none inset-0 ${contained ? 'absolute z-0' : 'fixed -z-10'}`}
        style={{ backgroundColor: base }}
        aria-hidden
      >
        {gameBackdrop?.imageUrl ? (
          <img
            src={gameBackdrop.imageUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : gameBackdrop?.colors ? (
          <div
            className="absolute inset-0"
            style={{
              background:
                gameBackdrop.colors.length >= 4
                  ? // The quiz designer's four corner colours, blended the way
                    // its own preview blends them.
                    `linear-gradient(135deg, ${gameBackdrop.colors[0]}, transparent 70%),
                     linear-gradient(225deg, ${gameBackdrop.colors[1]}, transparent 70%),
                     linear-gradient(45deg, ${gameBackdrop.colors[2]}, transparent 70%),
                     linear-gradient(315deg, ${gameBackdrop.colors[3]}, transparent 70%),
                     ${gameBackdrop.colors[0]}`
                  : `linear-gradient(135deg, ${gameBackdrop.colors[0]}, ${gameBackdrop.colors[gameBackdrop.colors.length - 1]})`,
            }}
          />
        ) : null}
        {/* Contained frames are a few hundred pixels wide, so the blobs are
            sized to the frame and the blur scaled down with them; vmax and a
            120px blur would wash the whole frame to one flat colour. */}
        {gameBackdrop ? null : (
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={`animate-blob absolute -left-[20%] top-[-10%] rounded-full ${contained ? 'size-[90%] blur-[28px]' : 'size-[70vmax] blur-[120px]'}`}
            style={{ background: primary, opacity }}
          />
          <div
            className={`animate-blob animation-delay-2000 absolute -right-[15%] top-[10%] rounded-full ${contained ? 'size-[80%] blur-[28px]' : 'size-[65vmax] blur-[120px]'}`}
            style={{ background: accent, opacity }}
          />
          <div
            className={`animate-blob animation-delay-4000 absolute bottom-[-20%] left-[20%] rounded-full ${contained ? 'size-[75%] blur-[28px]' : 'size-[60vmax] blur-[120px]'}`}
            style={{ background: primary, opacity: opacity * 0.85 }}
          />
        </div>
        )}
      </div>
      <div
        className={
          contained
            ? 'relative z-10 h-full'
            : fill
              ? 'relative flex min-h-0 flex-1 flex-col'
              : 'relative'
        }
      >
        {children}
      </div>
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -50px) scale(1.06); }
          66% { transform: translate(-35px, 30px) scale(0.94); }
        }
        .animate-blob { animation: blob 20s ease-in-out infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  )
}
