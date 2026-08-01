import { useNavigate, useParams } from 'react-router-dom'

import { GameEditForm } from '@/components/games/GameEditForm'
import { AdminPageShell } from '@/components/layout/AdminPageShell'

export function AdminGameEditPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()

  if (!gameId) return null

  return (
    <GameEditForm
      gameId={gameId}
      onSaved={() => navigate('/admin/games', { replace: true })}
      onCancel={() => navigate('/admin/games')}
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
