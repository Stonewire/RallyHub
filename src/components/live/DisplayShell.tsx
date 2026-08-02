import type { ReactNode } from 'react'

type DisplayShellProps = {
  logo: string | null
  title: string
  /** Pinned to the top-right corner, e.g. the countdown. */
  headerCorner?: ReactNode
  children: ReactNode
}

/** Centered display chrome: logo and one-line title, timer in the corner. */
export function DisplayShell({ logo, title, headerCorner, children }: DisplayShellProps) {
  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden">
      <header className="relative shrink-0 px-10 pt-10 pb-6">
        {headerCorner ? (
          <div className="absolute top-8 right-10 z-10">{headerCorner}</div>
        ) : null}
        <div className="mx-auto flex w-full flex-col items-center justify-center text-center">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="mb-5 max-h-24 max-w-[min(100%,320px)] object-contain drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
            />
          ) : null}
          {/* One line, always: the size shrinks with the viewport and with a
              long name rather than wrapping. The inset keeps it clear of the
              corner slot, which a long name otherwise runs under. */}
          <h1
            className={`font-sans w-full truncate text-[clamp(1.75rem,4.4vw,4.5rem)] leading-tight font-extrabold tracking-tight drop-shadow-md ${
              headerCorner ? 'px-4 md:px-40' : ''
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
