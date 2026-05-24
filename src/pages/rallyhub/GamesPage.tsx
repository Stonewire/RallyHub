import { Link } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { CoverImage } from '@/components/ui/cover-image'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePlatformGames, useRallyHubClients } from '@/hooks/use-rallyhub'
import { supabase } from '@/lib/supabase'

export function RallyHubGamesPage() {
  const { data: games, isLoading, isError, error, refetch } = usePlatformGames()
  const { data: clients } = useRallyHubClients()

  async function forceInstall(gameId: string) {
    const target = window.prompt(
      'Client organization ID (leave empty to install on ALL clients)',
    )
    const orgs = target?.trim()
      ? clients?.filter((c) => c.id === target.trim()) ?? []
      : clients ?? []

    for (const org of orgs) {
      const game = games?.find((g) => g.id === gameId)
      if (!game) continue
      await supabase.from('games').insert({
        organization_id: org.id,
        name: game.name,
        type: game.type,
        description: game.description,
        cover_url: game.cover_url,
        points_type: game.points_type,
        points_static: game.points_static,
        points_min: game.points_min,
        points_max: game.points_max,
        solution_description: game.solution_description,
        solution_image_url: game.solution_image_url,
        status: 'draft',
        config: game.config,
        is_platform_template: false,
        is_default_for_new_clients: false,
      })
    }
    alert(`Installed on ${orgs.length} client(s).`)
  }

  async function toggleDefault(gameId: string, current: boolean) {
    await supabase
      .from('games')
      .update({ is_default_for_new_clients: !current })
      .eq('id', gameId)
    void refetch()
  }

  return (
    <AdminPageShell
      title="Games"
      subtitle="Platform game templates for all clients."
      actions={
        <AccentButton asChild>
          <Link to="/admin/games/new">Create platform game</Link>
        </AccentButton>
      }
    >
      {isLoading ? (
        <QueryLoading rows={4} />
      ) : isError ? (
        <QueryError message={error?.message} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(games ?? []).map((game) => (
            <Card key={game.id} className="border-border/80 overflow-hidden bg-card shadow-sm">
              <CoverImage src={game.cover_url} className="aspect-[16/10] w-full" />
              <div className="space-y-3 p-4">
                <h3 className="font-semibold">{game.name}</h3>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={game.is_default_for_new_clients}
                    onChange={() =>
                      void toggleDefault(game.id, game.is_default_for_new_clients)
                    }
                  />
                  Add as Default for new clients
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => void forceInstall(game.id)}
                >
                  Force Install
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminPageShell>
  )
}
