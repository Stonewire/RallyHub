import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { NeoButton, NeoCard } from '@/components/neo-minimal'
import { InstallAppButton } from '@/components/pwa/InstallAppButton'
import { useAuth } from '@/contexts/auth-context'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { profileDisplayName } from '@/lib/auth-routes'

export function FacilitatorLandingPage() {
  const { t } = useTranslation('facilitator')
  const { user, profile, role } = useAuth()
  const name = profileDisplayName(profile)
  useDocumentTitle(t('landing.title'))

  return (
    <AuthPageShell>
      <NeoCard className="mx-auto w-full max-w-md space-y-6 p-8 text-center">
        <div className="space-y-2">
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            {t('landing.title')}
          </h1>
          {user && name ? (
            <p className="text-muted-foreground text-sm">{t('landing.signedInAs', { name })}</p>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t('landing.intro')}
        </p>
        {!user ? (
          <NeoButton variant="primary" size="lg" className="w-full" asChild>
            <Link to="/login" state={{ from: '/facilitator' }}>
              {t('landing.signIn')}
            </Link>
          </NeoButton>
        ) : role === 'event_manager' ? (
          <p className="text-destructive text-sm" role="alert">
            {t('landing.noAccess')}
          </p>
        ) : null}

        {/* This page, not the per-event console, is the durable thing to pin:
            an event link stops working once that event is over. */}
        <InstallAppButton className="w-full" />
      </NeoCard>
    </AuthPageShell>
  )
}
