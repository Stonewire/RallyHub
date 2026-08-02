import type { ReactNode } from 'react'

type DisplayShellProps = {
  logo: string | null
  title: string
  headerRight?: ReactNode
  children: ReactNode
}

/** Centered display chrome: logo + Montserrat title on top, content centered below. */
export function DisplayShell({
  logo,
  title,
  headerRight,
  children,
}: DisplayShellProps) {
  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden">
      <header className="relative shrink-0 px-10 pt-20 pb-6">
        {headerRight ? (
          <div className="absolute top-20 right-10 z-10">{headerRight}</div>
        ) : null}
        <div className="mx-auto flex w-full flex-col items-center justify-center text-center">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="mb-8 max-h-28 max-w-[min(100%,320px)] object-contain drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
            />
          ) : null}
          {/* Keeps clear of the timer in the corner: without the inset a long
              event name runs straight under it. */}
          <h1
            className={`font-sans max-w-5xl text-4xl font-extrabold tracking-tight drop-shadow-md md:text-6xl lg:text-7xl ${
              headerRight ? 'px-4 md:px-56' : ''
            }`}
          >
            {title}
          </h1>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-8 pb-10">
        <div className="flex h-full w-full max-w-6xl items-center justify-center">
          {children}
        </div>
      </main>
    </div>
  )
}
