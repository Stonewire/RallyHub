import { CheckCircle2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { NeoButton, NeoCard } from '@/components/neo-minimal'
import { useRallyHubClients } from '@/hooks/use-rallyhub'
import {
  useInstallMusicLibrary,
  type MusicInstallResult,
} from '@/hooks/use-music-library-install'

type Props = { onClose: () => void }
type Phase = 'select' | 'success'

export function InstallMusicLibraryModal({ onClose }: Props) {
  const clientsQuery = useRallyHubClients()
  const install = useInstallMusicLibrary()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<Phase>('select')
  const [results, setResults] = useState<MusicInstallResult[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  const clients = clientsQuery.data ?? []
  const organizationNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of clients) map[c.id] = c.name
    return map
  }, [clients])

  async function handleConfirm() {
    if (selected.size === 0) {
      onClose()
      return
    }
    setActionError(null)
    try {
      const res = await install.mutateAsync({
        organizationIds: [...selected],
        organizationNames,
      })
      setResults(res)
      setPhase('success')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Install failed')
    }
  }

  const succeeded = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)

  return (
    <div
      className="neo-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-music-title"
    >
      <NeoCard className="neo-modal-panel flex max-h-[min(32rem,90vh)] w-full max-w-md flex-col overflow-hidden p-0">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <h3 id="install-music-title" className="text-foreground font-semibold">
              {phase === 'select' ? 'Install music library' : 'Install complete'}
            </h3>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Copies every platform track into the selected clients (skips ones they already have).
            </p>
          </div>
          <NeoButton type="button" variant="ghost" size="sm" className="size-8 p-0" onClick={onClose}>
            <X className="size-4" />
          </NeoButton>
        </div>

        {phase === 'select' ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {clientsQuery.isLoading ? (
                <QueryLoading rows={4} />
              ) : clientsQuery.isError ? (
                <QueryError message={clientsQuery.error.message} />
              ) : clients.length === 0 ? (
                <p className="text-muted-foreground text-sm">No clients yet.</p>
              ) : (
                <ul className="space-y-2">
                  {clients.map((client) => (
                    <li key={client.id}>
                      <label className="border-border/80 hover:bg-muted/30 flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 shrink-0"
                          checked={selected.has(client.id)}
                          disabled={install.isPending}
                          onChange={(e) => {
                            setSelected((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(client.id)
                              else next.delete(client.id)
                              return next
                            })
                          }}
                        />
                        <span className="text-foreground min-w-0 flex-1 font-medium">
                          {client.name}
                        </span>
                      </label>
                    </li>
                  ))}
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
                disabled={install.isPending || selected.size === 0}
                onClick={() => void handleConfirm()}
              >
                {install.isPending
                  ? 'Installing…'
                  : `Install to ${selected.size} client${selected.size === 1 ? '' : 's'}`}
              </NeoButton>
            </div>
          </>
        ) : (
          <div className="space-y-4 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-foreground font-medium">
                  Installed to {succeeded.length} client{succeeded.length === 1 ? '' : 's'}.
                </p>
                {succeeded.length > 0 ? (
                  <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                    {succeeded.map((r) => (
                      <li key={r.organizationName}>
                        {r.organizationName}
                        {typeof r.count === 'number' ? ` — ${r.count} added` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            {failed.length > 0 ? (
              <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3">
                <p className="text-destructive text-sm font-medium">
                  {failed.length} client{failed.length === 1 ? '' : 's'} failed:
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
              <NeoButton type="button" variant="primary" onClick={onClose}>
                Done
              </NeoButton>
            </div>
          </div>
        )}
      </NeoCard>
    </div>
  )
}
