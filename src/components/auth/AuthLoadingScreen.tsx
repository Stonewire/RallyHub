export function AuthLoadingScreen({ label = 'Loading session' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="bg-background flex min-h-svh items-center justify-center"
    >
      <div className="border-muted-foreground/20 border-t-foreground size-10 animate-spin rounded-full border-[3px]" />
    </div>
  )
}
