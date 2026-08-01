import { IconCheck, IconClose } from '@/components/icons'
import { useEffect, useMemo, useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import type { GameRow } from '@/hooks/use-games'
import {
  useGroupClientInstallStatus,
  useInstallPlatformGameGroup,
  useRallyHubClients,
  type InstallPlatformGameGroupSummary,
} from '@/hooks/use-rallyhub'
import { groupInstallStatusKey } from '@/lib/install-platform-game-group'

type InstallGameGroupModalProps = {
  groupName: string
  games: GameRow[]
  onClose: () => void
}

type Phase = 'select' | 'success'

export function InstallGameGroupModal({
  groupName,
  games,
  onClose,
}: InstallGameGroupModalProps) {
  const clientsQuery = useRallyHubClients()
  const installStatusQuery = useGroupClientInstallStatus(games)
  const install = useInstallPlatformGameGroup()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<Phase>('select')
  const [summary, setSummary] = useState<InstallPlatformGameGroupSummary | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const installStatus = installStatusQuery.data ?? new Map()
  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data])

  const organizationNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const client of clients) {
      map[client.id] = client.name
    }
    return map
  }, [clients])

  const gamesKey = useMemo(() => groupInstallStatusKey(games.map((g) => g.id)), [games])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets modal state when the target group/games identity changes
    setSelected(new Set())
    setPhase('select')
    setSummary(null)
    setActionError(null)
  }, [groupName, gamesKey])

  const pendingInstallIds = [...selected].filter((id) => !installStatus.get(id)?.allInstalled)

  async function handleConfirm() {
    if (pendingInstallIds.length === 0) {
      onClose()
      return
    }

    setActionError(null)
    try {
      const result = await install.mutateAsync({
        groupName,
        templates: games,
        organizationIds: pendingInstallIds,
        organizationNames,
      })
      setSummary(result)
      setPhase('success')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Install failed')
    }
  }

  const successClients = summary?.results.filter((r) => r.ok) ?? []
  const failedClients = summary?.results.filter((r) => !r.ok) ?? []
  const totalInstalled =
    summary?.results.reduce((sum, r) => sum + r.installedCount, 0) ?? 0
  const totalSkipped =
    summary?.results.reduce((sum, r) => sum + r.skippedCount, 0) ?? 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-group-title"
    >
      <Card className="border-border/80 bg-card shadow-2xl flex max-h-[min(36rem,90vh)] w-full max-w-md flex-col overflow-hidden p-0">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <h3 id="install-group-title" className="text-foreground font-semibold">
              {phase === 'select' ? 'Install game group' : 'Install complete'}
            </h3>
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {groupName}
              <span className="text-muted-foreground/80">
                {' '}
                · {games.length} game{games.length === 1 ? '' : 's'}
              </span>
            </p>
          </div>
          <NeoButton type="button" variant="ghost" size="sm" className="size-8 p-0" onClick={onClose}>
            <IconClose className="size-4" />
          </NeoButton>
        </div>

        {phase === 'select' ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {clientsQuery.isLoading || installStatusQuery.isLoading ? (
                <QueryLoading rows={4} />
              ) : clientsQuery.isError ? (
                <QueryError message={clientsQuery.error.message} />
              ) : installStatusQuery.isError ? (
                <QueryError message={installStatusQuery.error.message} />
              ) : clients.length === 0 ? (
                <p className="text-muted-foreground text-sm">No clients yet.</p>
              ) : games.length === 0 ? (
                <p className="text-muted-foreground text-sm">This group has no games to install.</p>
              ) : (
                <ul className="space-y-2">
                  {clients.map((client) => {
                    const status = installStatus.get(client.id)
                    const installedCount = status?.installedCount ?? 0
                    const allInstalled = status?.allInstalled ?? false
                    const checked = allInstalled || selected.has(client.id)

                    return (
                      <li key={client.id}>
                        <label
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                            allInstalled
                              ? 'border-border/60 bg-muted/40'
                              : 'border-border/80 hover:bg-muted/30 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="size-4 shrink-0"
                            checked={checked}
                            disabled={allInstalled || install.isPending}
                            onChange={(e) => {
                              if (allInstalled) return
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
                            {allInstalled ? (
                              <span className="text-muted-foreground ml-2 text-xs">
                                All games already installed
                              </span>
                            ) : installedCount > 0 ? (
                              <span className="text-muted-foreground ml-2 text-xs">
                                {installedCount}/{games.length} already installed
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
              <NeoButton type="button" variant="surface" onClick={onClose} disabled={install.isPending}>
                Cancel
              </NeoButton>
              <NeoButton
                type="button"
                variant="primary"
                disabled={
                  install.isPending ||
                  clientsQuery.isLoading ||
                  installStatusQuery.isLoading ||
                  games.length === 0 ||
                  pendingInstallIds.length === 0
                }
                onClick={() => void handleConfirm()}
              >
                {install.isPending
                  ? 'Installing…'
                  : pendingInstallIds.length === 0
                    ? 'Install group'
                    : `Install to ${pendingInstallIds.length} client${pendingInstallIds.length === 1 ? '' : 's'}`}
              </NeoButton>
            </div>
          </>
        ) : (
          <div className="space-y-4 overflow-y-auto p-4">
            <div className="flex items-start gap-3">
              <IconCheck className="text-primary mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-foreground font-medium">
                  Installed {totalInstalled} game{totalInstalled === 1 ? '' : 's'} from &quot;
                  {summary?.groupName ?? groupName}&quot; to {successClients.length} client
                  {successClients.length === 1 ? '' : 's'}.
                </p>
                {totalSkipped > 0 ? (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {totalSkipped} game{totalSkipped === 1 ? '' : 's'} were already present and
                    were skipped.
                  </p>
                ) : null}
                {successClients.length > 0 ? (
                  <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                    {successClients.map((r) => (
                      <li key={r.organizationId}>
                        {r.organizationName}
                        {r.installedCount > 0 || r.skippedCount > 0 ? (
                          <span className="text-muted-foreground/80">
                            {' '}
                            ({r.installedCount} new, {r.skippedCount} skipped)
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            {failedClients.length > 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-destructive text-sm font-medium">
                  {failedClients.length} client{failedClients.length === 1 ? '' : 's'} had errors:
                </p>
                <ul className="text-destructive mt-2 space-y-2 text-sm">
                  {failedClients.map((r) => (
                    <li key={r.organizationId}>
                      <span className="font-medium">{r.organizationName}</span>
                      {r.error ? ` — ${r.error}` : null}
                      {r.gameErrors.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 pl-3">
                          {r.gameErrors.map((ge) => (
                            <li key={`${r.organizationId}-${ge.gameName}`}>
                              {ge.gameName}: {ge.error}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex justify-end">
              <NeoButton type="button" variant="primary" onClick={onClose}>
                Done
              </NeoButton>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
