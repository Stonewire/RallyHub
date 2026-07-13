import { Link } from 'react-router-dom'

import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { NeoButton, NeoCard } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { profileDisplayName } from '@/lib/auth-routes'

export function FacilitatorLandingPage() {
  const { user, profile, role } = useAuth()
  const name = profileDisplayName(profile)
  useDocumentTitle('Facilitator')

  return (
    <AuthPageShell>
      <NeoCard className="mx-auto w-full max-w-md space-y-6 p-8 text-center">
        <div className="space-y-2">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            Facilitator
          </h1>
          {user && name ? (
            <p className="text-muted-foreground text-sm">Signed in as {name}</p>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Open an event facilitator link from your organization to run a live event.
          Paste the link in your browser or use the bookmark from your event settings.
        </p>
        {!user ? (
          <NeoButton variant="primary" size="lg" className="w-full" asChild>
            <Link to="/login" state={{ from: '/facilitator' }}>
              Sign in
            </Link>
          </NeoButton>
        ) : role === 'event_manager' ? (
          <p className="text-destructive text-sm" role="alert">
            Your account does not have facilitator access. Ask your organization admin
            for a facilitator account or use an admin link instead.
          </p>
        ) : null}
      </NeoCard>
    </AuthPageShell>
  )
}
