import type { ReactNode } from 'react'

type DisplayShellProps = {
  logo: string | null
  title: string
  /** Rendered centred under the title, e.g. the countdown. */
  headerSlot?: ReactNode
  children: ReactNode
}

/** Centered display chrome: logo, one-line title, timer beneath, content below. */
export function DisplayShell({ logo, title, headerSlot, children }: DisplayShellProps) {
  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 px-10 pt-14 pb-6">
        <div className="mx-auto flex w-full flex-col items-center justify-center text-center">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="mb-6 max-h-24 max-w-[min(100%,320px)] object-contain drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)]"
            />
          ) : null}
          {/* One line, always: the size shrinks with the viewport and with a
              long name rather than wrapping to a second and third row. */}
          <h1 className="font-sans w-full truncate text-[clamp(1.75rem,4.4vw,4.5rem)] leading-tight font-extrabold tracking-tight drop-shadow-md">
            {title}
          </h1>
          {headerSlot ? <div className="mt-5">{headerSlot}</div> : null}
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
