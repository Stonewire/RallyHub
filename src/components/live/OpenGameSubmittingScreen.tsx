type OpenGameSubmittingScreenProps = {
  accentColor: string
}

/** Full-screen loading state while an open-stage submission uploads/saves. */
export function OpenGameSubmittingScreen({ accentColor }: OpenGameSubmittingScreenProps) {
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
      <p className="mt-5 text-lg font-semibold text-white">Submitting…</p>
    </div>
  )
}
