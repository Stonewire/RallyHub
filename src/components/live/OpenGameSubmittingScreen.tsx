type OpenGameSubmittingScreenProps = {
  accentColor: string
  /** 0-100 while an upload reports progress; null keeps the plain spinner. */
  progress?: number | null
}

/** Full-screen loading state while an open-stage submission uploads/saves. */
export function OpenGameSubmittingScreen({ accentColor, progress }: OpenGameSubmittingScreenProps) {
  const showProgress = typeof progress === 'number'
  return (
    <div
      className="flex min-h-[min(420px,55vh)] flex-col items-center justify-center px-6 py-16 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="size-11 animate-spin rounded-full border-[3px] border-white/20 border-t-current"
        style={{ color: accentColor }}
        aria-hidden
      />
      <p className="mt-5 text-lg font-semibold text-white">
        {showProgress ? `Uploading… ${progress}%` : 'Submitting…'}
      </p>
      {showProgress ? (
        <>
          <div className="mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progress}%`, backgroundColor: accentColor }}
            />
          </div>
          <p className="mt-3 text-sm text-white/70">
            Videos can take a while on event wifi — keep this screen open.
          </p>
        </>
      ) : null}
    </div>
  )
}
