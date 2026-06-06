import { CheckCircle2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AccentButton } from '@/components/admin/AccentButton'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { GameRow } from '@/hooks/use-games'
import {
  useGameClientInstallStatus,
  useInstallPlatformGame,
  useRallyHubClients,
} from '@/hooks/use-rallyhub'

type InstallGameModalProps = {
  game: GameRow
  onClose: () => void
}

type Phase = 'select' | 'success'

export function InstallGameModal({ game, onClose }: InstallGameModalProps) {
  const clientsQuery = useRallyHubClients()
  const installedQuery = useGameClientInstallStatus(game)
  const install = useInstallPlatformGame()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<Phase>('select')
  const [installResults, setInstallResults] = useState<
    { organizationName: string; ok: boolean; error?: string }[]
  >([])
  const [actionError, setActionError] = useState<string | null>(null)

  const installedOrgIds = installedQuery.data ?? new Set<string>()
  const clients = clientsQuery.data ?? []

  const organizationNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const client of clients) {
      map[client.id] = client.name
    }
    return map
  }, [clients])

  useEffect(() => {
    setSelected(new Set())
    setPhase('select')
    setInstallResults([])
    setActionError(null)
  }, [game.id])

  const pendingInstallIds = [...selected].filter((id) => !installedOrgIds.has(id))

  async function handleConfirm() {
    if (pendingInstallIds.length === 0) {
      onClose()
      return
    }

    setActionError(null)
    try {
      const results = await install.mutateAsync({
        template: game,
        organizationIds: pendingInstallIds,
        organizationNames,
      })
      setInstallResults(results)
      setPhase('success')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Install failed')
    }
  }

  const successCount = installResults.filter((r) => r.ok).length
  const failed = installResults.filter((r) => !r.ok)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-game-title"
    >
      <Card className="border-border/80 flex max-h-[min(32rem,90vh)] w-full max-w-md flex-col bg-card shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <h3 id="install-game-title" className="text-foreground font-semibold">
              {phase === 'select' ? 'Install game' : 'Install complete'}
            </h3>
            <p className="text-muted-foreground mt-0.5 truncate text-sm">{game.name}</p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {phase === 'select' ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {clientsQuery.isLoading || installedQuery.isLoading ? (
                <QueryLoading rows={4} />
              ) : clientsQuery.isError ? (
                <QueryError message={clientsQuery.error.message} />
              ) : installedQuery.isError ? (
                <QueryError message={installedQuery.error.message} />
              ) : clients.length === 0 ? (
                <p className="text-muted-foreground text-sm">No clients yet.</p>
              ) : (
                <ul className="space-y-2">
                  {clients.map((client) => {
                    const alreadyInstalled = installedOrgIds.has(client.id)
                    const checked = alreadyInstalled || selected.has(client.id)

                    return (
                      <li key={client.id}>
                        <label
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                            alreadyInstalled
                              ? 'border-border/60 bg-muted/40'
                              : 'border-border/80 hover:bg-muted/30 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="size-4 shrink-0"
                            checked={checked}
                            disabled={alreadyInstalled || install.isPending}
                            onChange={(e) => {
                              if (alreadyInstalled) return
                              setSelected((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(client.id)
                                else next.delete(client.id)
                                return next
                              })
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="text-foreground font-medium">{client.name}</span>
                            {alreadyInstalled ? (
                              <span className="text-muted-foreground ml-2 text-xs">
                                Already installed
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {actionError ? (
              <p className="text-destructive px-4 text-sm" role="alert">
                {actionError}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 border-t p-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={install.isPending}>
                Cancel
              </Button>
              <AccentButton
                type="button"
                disabled={
                  install.isPending ||
                  clientsQuery.isLoading ||
                  installedQuery.isLoading ||
                  pendingInstallIds.length === 0
                }
                onClick={() => void handleConfirm()}
              >
                {install.isPending
                  ? 'Installing…'
                  : pendingInstallIds.length === 0
                    ? 'Install'
                    : `Install to ${pendingInstallIds.length} client${pendingInstallIds.length === 1 ? '' : 's'}`}
              </AccentButton>
            </div>
          </>
        ) : (
          <div className="space-y-4 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-foreground font-medium">
                  Installed to {successCount} client{successCount === 1 ? '' : 's'}.
                </p>
                {successCount > 0 ? (
                  <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                    {installResults
                      .filter((r) => r.ok)
                      .map((r) => (
                        <li key={r.organizationName}>{r.organizationName}</li>
                      ))}
                  </ul>
                ) : null}
              </div>
            </div>

            {failed.length > 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-destructive text-sm font-medium">
                  {failed.length} client{failed.length === 1 ? '' : 's'} could not be installed:
                </p>
                <ul className="text-destructive mt-2 space-y-1 text-sm">
                  {failed.map((r) => (
                    <li key={r.organizationName}>
                      {r.organizationName}
                      {r.error ? ` — ${r.error}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex justify-end">
              <AccentButton type="button" onClick={onClose}>
                Done
              </AccentButton>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
