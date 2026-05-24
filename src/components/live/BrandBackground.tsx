import type { ReactNode } from 'react'

type BrandBackgroundProps = {
  colors: [string, string, string]
  variant?: 'default' | 'disco' | 'relaxed'
  children: ReactNode
}

export function BrandBackground({
  colors,
  variant = 'default',
  children,
}: BrandBackgroundProps) {
  const [a, b, c] = colors
  const opacity = variant === 'relaxed' ? 0.35 : variant === 'disco' ? 0.55 : 0.45

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f0f10] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="animate-blob absolute -left-1/4 top-0 size-[55vmax] rounded-full blur-[100px]"
          style={{ background: a, opacity }}
        />
        <div
          className="animate-blob animation-delay-2000 absolute right-0 top-1/4 size-[50vmax] rounded-full blur-[100px]"
          style={{ background: b, opacity }}
        />
        <div
          className="animate-blob animation-delay-4000 absolute bottom-0 left-1/3 size-[45vmax] rounded-full blur-[100px]"
          style={{ background: c, opacity }}
        />
      </div>
      <div className="relative z-10">{children}</div>
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-25px, 20px) scale(0.95); }
        }
        .animate-blob { animation: blob 18s ease-in-out infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  )
}
