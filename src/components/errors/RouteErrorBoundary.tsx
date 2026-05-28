import { Button } from '@/components/ui/button'

export function RouteErrorBoundary() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="border-border/80 bg-card w-full max-w-lg rounded-xl border p-6 text-center shadow-sm">
        <h1 className="text-foreground text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The live panel hit an unexpected error. Reload to reconnect.
        </p>
        <div className="mt-5 flex justify-center">
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    </div>
  )
}
