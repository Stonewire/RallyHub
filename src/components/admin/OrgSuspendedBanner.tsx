import { Card } from '@/components/ui/card'
import { isOrgSuspended } from '@/lib/account-status'

/** Shown on create surfaces when the org is suspended. Renders nothing otherwise. */
export function OrgSuspendedBanner({ accountStatus }: { accountStatus?: string | null }) {
  if (!isOrgSuspended(accountStatus)) return null
  return (
    <Card className="mb-6 border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-sm">
      Your account is suspended. You can view existing events and games, but creating new ones is
      disabled. Contact RallyHub to reactivate your account.
    </Card>
  )
}
