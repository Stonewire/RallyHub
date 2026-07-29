import { LogOut } from 'lucide-react'

type LoggedOutScreenProps = {
  onLogBackIn: () => void
}

/** Full-screen confirmation shown after the user signs out from the header. */
export function LoggedOutScreen({ onLogBackIn }: LoggedOutScreenProps) {
  return (
    <div className="bg-background fixed inset-0 z-200 flex items-center justify-center">
      <div className="bg-nm-surface border-border rounded-nm-lg flex w-90 max-w-[92vw] flex-col items-center gap-3 border p-6 text-center shadow-lg">
        <div className="bg-nm-slate-100 text-nm-slate-700 flex size-12 items-center justify-center rounded-full">
          <LogOut className="size-5" strokeWidth={2} />
        </div>
        <h1 className="text-lg font-bold">You've been logged out</h1>
        <p className="text-nm-neutral-500 text-sm">
          For your security, your session has ended. Log back in to continue.
        </p>
        <button
          type="button"
          onClick={onLogBackIn}
          className="bg-nm-yellow text-nm-charcoal rounded-nm-md h-9 w-full text-sm font-semibold"
        >
          Log Back In
        </button>
      </div>
    </div>
  )
}
