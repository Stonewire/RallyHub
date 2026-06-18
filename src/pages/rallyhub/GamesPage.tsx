import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { CoverImage } from '@/components/ui/cover-image'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNotification } from '@/contexts/notification-context'
import { platformGameInstallPayload } from '@/lib/install-platform-game'
import { usePlatformGames, useRallyHubClients } from '@/hooks/use-rallyhub'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'

export function RallyHubGamesPage() {
  const { data: games, isLoading, isError, error, refetch } = usePlatformGames()
  const { data: clients } = useRallyHubClients()
  const { notify } = useNotification()
  const [installDialog, setInstallDialog] = useState<{ gameId: string; orgId: string } | null>(null)
  const [installing, setInstalling] = useState(false)

  async function runForceInstall(gameId: string, orgId: string) {
    const orgs = orgId.trim()
      ? clients?.filter((c) => c.id === orgId.trim()) ?? []
      : clients ?? []
    setInstalling(true)
    try {
      for (const org of orgs) {
        const game = games?.find((g) => g.id === gameId)
        if (!game) continue
        await supabase.from('games').insert(platformGameInstallPayload(game, org.id))
      }
      notify(`Installed on ${orgs.length} client(s).`)
    } finally {
      setInstalling(false)
      setInstallDialog(null)
    }
  }

  async function toggleDefault(gameId: string, current: boolean) {
    const { error } = await supabase
      .from('games')
      .update({ is_default_for_new_clients: !current })
      .eq('id', gameId)
    if (error) {
      notify(error.message || 'Could not update default')
      return
    }
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
                  onClick={() => setInstallDialog({ gameId: game.id, orgId: '' })}
                >
                  Force Install
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {installDialog ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="force-install-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <div className="bg-card border-border/80 w-full max-w-sm rounded-xl border p-6 shadow-lg">
            <h2 id="force-install-title" className="text-foreground mb-4 font-semibold">Force Install</h2>
            <div className="mb-5 space-y-2">
              <Label htmlFor="force-install-org">Client org ID (leave empty for ALL clients)</Label>
              <Input
                id="force-install-org"
                value={installDialog.orgId}
                onChange={(e) => setInstallDialog((d) => d ? { ...d, orgId: e.target.value } : d)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="bg-background"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setInstallDialog(null)}>Cancel</Button>
              <Button
                size="sm"
                disabled={installing}
                onClick={() => void runForceInstall(installDialog.gameId, installDialog.orgId)}
              >
                {installing ? 'Installing…' : 'Install'}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </AdminPageShell>
  )
}
