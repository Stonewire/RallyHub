import { Link } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import { Button } from '@/components/ui/button'

export function PlatformHomePage() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center px-6 py-16 text-center">
      <RallyLogo className="mb-10 max-h-20 w-auto" />
      <h1 className="text-foreground mb-3 text-3xl font-bold tracking-tight">RallyHub</h1>
      <p className="text-muted-foreground mb-8 max-w-md text-sm">
        Team experiences for live events. Marketing site coming soon.
      </p>
      <Button asChild variant="outline">
        <Link to="/login">Staff sign in</Link>
      </Button>
    </div>
  )
}
