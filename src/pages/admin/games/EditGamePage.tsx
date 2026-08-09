import { useNavigate, useParams } from 'react-router-dom'

import { useOptionalTenant } from '@/contexts/tenant-context'
import { orgPath } from '@/lib/org-path'
import { GameEditForm } from '@/components/games/GameEditForm'
import { AdminPageShell } from '@/components/layout/AdminPageShell'

export function AdminGameEditPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const clientSlug = useOptionalTenant()?.tenantOrg?.subdomain ?? null

  if (!gameId) return null

  return (
    <GameEditForm
      gameId={gameId}
      onSaved={() => navigate(orgPath(clientSlug, '/admin/games'), { replace: true })}
      onCancel={() => navigate(orgPath(clientSlug, '/admin/games'))}
    >
      {({ headerTitle, headerSubtitle, headerActions, body }) => (
        <AdminPageShell
          title={headerTitle}
          subtitle={headerSubtitle}
          actions={headerActions}
        >
          {body}
        </AdminPageShell>
      )}
    </GameEditForm>
  )
}
