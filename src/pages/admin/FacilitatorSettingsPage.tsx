import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { MyAccountPanel } from '@/components/admin/MyAccountPanel'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

export function FacilitatorSettingsPage() {
  const { t } = useTranslation('admin')
  const { profile } = useAuth()
  const orgId = profile?.organization_id ?? null

  const { data: orgName } = useQuery({
    queryKey: ['facilitator-org-name', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId!)
        .maybeSingle()
      if (error) throw error
      return data?.name ?? null
    },
  })

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {t('settings.page.facilitatorProfileTitle')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('settings.page.facilitatorProfileSubtitle')}
        </p>
      </header>

      <MyAccountPanel orgName={orgName} />
    </div>
  )
}
