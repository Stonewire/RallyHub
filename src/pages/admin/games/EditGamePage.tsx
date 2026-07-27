import { useNavigate, useParams } from 'react-router-dom'

import { GameEditForm } from '@/components/games/GameEditForm'
import { AdminPageShell } from '@/components/layout/AdminPageShell'

export function AdminGameEditPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()

  if (!gameId) return null

  return (
    <GameEditForm gameId={gameId} onSaved={() => navigate('/admin/games', { replace: true })}>
      {({ headerTitle, headerSubtitle, headerActions, body }) => (
        <AdminPageShell
          title={headerTitle}
          subtitle={headerSubtitle}
          backTo="/admin/games"
          backLabel="Back to games"
          actions={headerActions}
        >
          {body}
        </AdminPageShell>
      )}
    </GameEditForm>
  )
}
