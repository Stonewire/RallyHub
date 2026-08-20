import { useTranslation } from 'react-i18next'

import {
  NoOrganizationMessage,
} from '@/components/admin/QueryState'
import { TeamUsersPanel } from '@/components/admin/TeamUsersPanel'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { useOrganizationId } from '@/hooks/use-organization-id'

export function AdminTeamPage() {
  const { t } = useTranslation('admin')
  const organizationId = useOrganizationId()

  if (!organizationId) {
    return (
      <AdminPageShell title={t('team.title')} subtitle={t('team.noOrgSubtitle')}>
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  return (
    <AdminPageShell
      title={t('team.title')}
      subtitle={t('team.pageSubtitle')}
    >
      <TeamUsersPanel facilitatorsOnly />
    </AdminPageShell>
  )
}
