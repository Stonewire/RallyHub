import { IconClose, IconDownload, IconFileUp } from '@/components/icons'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'

import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useNotification } from '@/contexts/notification-context'
import type { GameGroupWithItems } from '@/hooks/use-game-groups'
import { downloadCsv } from '@/lib/csv'
import {
  buildGameImportPlan,
  buildGameImportTemplate,
  parseCsv,
  type GameImportPlan,
} from '@/lib/game-import'
import { queryKeys } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'

type GameImportModalProps = {
  organizationId: string
  isPlatformLibrary: boolean
  groups: GameGroupWithItems[]
  onClose: () => void
}

/** Batch game import: download the CSV template, fill it, upload, review, import. */
export function GameImportModal({
  organizationId,
  isPlatformLibrary,
  groups,
  onClose,
}: GameImportModalProps) {
  const { t } = useTranslation('admin')
  const { notify } = useNotification()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [plan, setPlan] = useState<GameImportPlan | null>(null)
  const [importing, setImporting] = useState(false)

  async function handleFile(file: File) {
    setFileName(file.name)
    const text = await file.text()
    setPlan(buildGameImportPlan(parseCsv(text)))
  }

  async function runImport() {
    if (!plan || plan.games.length === 0) return
    setImporting(true)
    try {
      // Existing groups by name (case-insensitive); create the missing ones.
      const groupIdByName = new Map<string, string>(
        groups.map((g) => [g.name.trim().toLowerCase(), g.id]),
      )
      const missing = plan.groupNames.filter(
        (n) => !groupIdByName.has(n.trim().toLowerCase()),
      )
      if (missing.length > 0) {
        const { data: created, error } = await supabase
          .from('game_groups')
          .insert(missing.map((name) => ({ organization_id: organizationId, name })))
          .select('id, name')
        if (error) throw error
        for (const g of created ?? []) {
          groupIdByName.set(g.name.trim().toLowerCase(), g.id)
        }
      }

      const { data: inserted, error: gamesErr } = await supabase
        .from('games')
        .insert(
          plan.games.map((g) => ({
            organization_id: organizationId,
            name: g.name,
            type: g.type,
            description: g.description,
            points_type: g.points_type,
            points_static: g.points_static,
            points_min: g.points_min,
            points_max: g.points_max,
            status: 'draft',
            is_platform_template: isPlatformLibrary,
            config: g.config,
          })),
        )
        .select('id, name')
      if (gamesErr) throw gamesErr

      // Link games to their groups by list position (same order as inserted).
      const links = (inserted ?? []).flatMap((row, i) => {
        const groupName = plan.games[i]?.groupName
        const groupId = groupName
          ? groupIdByName.get(groupName.trim().toLowerCase())
          : null
        return groupId ? [{ group_id: groupId, game_id: row.id }] : []
      })
      if (links.length > 0) {
        const { error: linkErr } = await supabase.from('game_group_items').insert(links)
        if (linkErr) throw linkErr
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.games(organizationId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.platformLibraryGames() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.gameGroups(organizationId) })
      notify(
        plan.groupNames.length > 0
          ? t('games.import.importedWithGroups', {
              count: plan.games.length,
              groups: plan.groupNames.length,
            })
          : t('games.import.imported', { count: plan.games.length }),
      )
      onClose()
    } catch (err) {
      notify(err instanceof Error ? err.message : t('games.import.failed'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-import-title"
    >
      <Card className="border-border/80 max-h-[85vh] w-full max-w-xl space-y-4 overflow-auto bg-card p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 id="game-import-title" className="text-foreground font-semibold">
            {t('games.import.title')}
          </h3>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <IconClose className="size-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">{t('games.import.description')}</p>
          <div className="flex flex-wrap gap-2">
            <NeoButton
              type="button"
              variant="surface"
              size="sm"
              onClick={() => downloadCsv('rallyhub-games-template', buildGameImportTemplate())}
            >
              <IconDownload className="size-4" />
              {t('games.import.downloadTemplate')}
            </NeoButton>
            <NeoButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <IconFileUp className="size-4" />
              {t('games.import.uploadTemplate')}
            </NeoButton>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {plan ? (
          <div className="space-y-3">
            <p className="text-foreground text-sm font-medium">
              {fileName}: {t('games.import.ready', { count: plan.games.length })}
              {plan.groupNames.length > 0
                ? ` · ${t('games.import.groups', { groups: plan.groupNames.join(', ') })}`
                : ''}
            </p>

            {plan.games.length > 0 ? (
              <ul className="border-border/70 max-h-48 space-y-1 overflow-auto rounded-lg border p-2 text-sm">
                {plan.games.map((g, i) => (
                  <li key={`${g.name}-${i}`} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-14 shrink-0 text-xs uppercase">
                      {g.type}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {g.points_type === 'range'
                        ? `${g.points_min}-${g.points_max}`
                        : g.points_static}{' '}
                      {t('common:pts')}
                      {g.type === 'quiz'
                        ? ` · ${t('games.import.questionCount', {
                            total: g.config.questions?.length ?? 0,
                          })}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {plan.errors.length > 0 ? (
              <div className="border-destructive/40 bg-destructive/5 space-y-1 rounded-lg border p-3">
                <p className="text-destructive text-sm font-medium">
                  {t('games.import.rowsSkipped', { count: plan.errors.length })}
                </p>
                <ul className="text-destructive/90 list-disc space-y-0.5 pl-4 text-xs">
                  {plan.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common:cancel')}
              </Button>
              <NeoButton
                type="button"
                variant="primary"
                disabled={plan.games.length === 0 || importing}
                onClick={() => void runImport()}
              >
                {importing
                  ? t('games.import.importing')
                  : t('games.import.submit', { count: plan.games.length })}
              </NeoButton>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
