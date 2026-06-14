import type { ReactNode } from 'react'

import { brandBlobColors, displayTextClass } from '@/lib/live-event'
import type { TenantPublicOrg } from '@/lib/tenant'
import type { Tables } from '@/types/helpers'

type BrandBackgroundProps = {
  event: Tables<'events'>
  organization: TenantPublicOrg | Tables<'organizations'> | null
  variant?: 'default' | 'disco' | 'relaxed'
  children: ReactNode
  className?: string
}

export function BrandBackground({
  event,
  organization,
  variant = 'default',
  children,
  className,
}: BrandBackgroundProps) {
  const { base, primary, accent } = brandBlobColors(event, organization)
  const opacity = variant === 'relaxed' ? 0.4 : variant === 'disco' ? 0.6 : 0.55
  const textTone = displayTextClass(event)

  return (
    <div
      className={`experience-scope relative min-h-screen overflow-x-hidden ${textTone} ${className ?? ''}`}
      style={{ backgroundColor: base }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="animate-blob absolute -left-[20%] top-[-10%] size-[70vmax] rounded-full blur-[120px]"
          style={{ background: primary, opacity }}
        />
        <div
          className="animate-blob animation-delay-2000 absolute -right-[15%] top-[10%] size-[65vmax] rounded-full blur-[120px]"
          style={{ background: accent, opacity }}
        />
        <div
          className="animate-blob animation-delay-4000 absolute bottom-[-20%] left-[20%] size-[60vmax] rounded-full blur-[120px]"
          style={{ background: primary, opacity: opacity * 0.85 }}
        />
      </div>
      <div className="relative z-10">{children}</div>
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
