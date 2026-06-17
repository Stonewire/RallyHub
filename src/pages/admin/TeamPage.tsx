import {
  NoOrganizationMessage,
} from '@/components/admin/QueryState'
import { TeamUsersPanel } from '@/components/admin/TeamUsersPanel'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { useOrganizationId } from '@/hooks/use-organization-id'

export function AdminTeamPage() {
  const organizationId = useOrganizationId()

  if (!organizationId) {
    return (
      <AdminPageShell title="Team" subtitle="Manage organization users.">
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  return (
    <AdminPageShell
      title="Team"
      subtitle="Add facilitator accounts with temporary passwords for first login."
    >
      <TeamUsersPanel facilitatorsOnly />
    </AdminPageShell>
  )
}
