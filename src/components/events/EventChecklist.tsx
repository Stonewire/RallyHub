import { IconChevronDown, IconChevronRight, IconClose, IconDownload } from '@/components/icons'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { QueryError, QueryLoading } from '@/components/admin/QueryState'
import { useEvent, useEventGameIds, useUpdateEventChecklistState } from '@/hooks/use-events'
import { useGames } from '@/hooks/use-games'
import { useInventoryItems } from '@/hooks/use-inventory'
import { parseStoreConfig } from '@/lib/event-form-utils'
import {
  buildEventChecklist,
  parseChecklistState,
  type ChecklistSourceInput,
} from '@/lib/event-checklist'
import type { GameConfig } from '@/types/game-config'

type EventChecklistProps = {
  eventId: string
  organizationId: string | null
  onClose: () => void
}

export function EventChecklist({ eventId, organizationId, onClose }: EventChecklistProps) {
  const { t } = useTranslation('admin')
  const eventQuery = useEvent(eventId)
  const gameIdsQuery = useEventGameIds(eventId)
  const gamesQuery = useGames(organizationId)
  const inventoryQuery = useInventoryItems(organizationId)
  const saveState = useUpdateEventChecklistState(eventId)

  const event = eventQuery.data
  const teamCount = event?.team_count ?? 0

  const sources = useMemo<ChecklistSourceInput[]>(() => {
    if (!event) return []
    const list: ChecklistSourceInput[] = []
    const eventGameIds = new Set(gameIdsQuery.data ?? [])
    for (const game of gamesQuery.data ?? []) {
      if (!eventGameIds.has(game.id)) continue
      const items = ((game.config as GameConfig)?.checklist ?? []).filter(Boolean)
      if (items.length) list.push({ kind: 'game', label: game.name, items })
    }
    if (event.inventory_enabled !== false) {
      const byId = new Map((inventoryQuery.data ?? []).map((i) => [i.id, i]))
      for (const row of parseStoreConfig(event.store_config)) {
        const item = byId.get(row.itemId)
        const items = (item?.checklist_items ?? []).filter(Boolean)
        if (item && items.length) list.push({ kind: 'store', label: item.name, items })
      }
    }
    return list
  }, [event, gameIdsQuery.data, gamesQuery.data, inventoryQuery.data])

  const rows = useMemo(() => buildEventChecklist(sources, teamCount), [sources, teamCount])

  // Local tick state, seeded from the event and reset whenever the team count
  // changes (stored ticks were counted against the old number, so they're stale).
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (!event) return
    // Re-seed local ticks whenever the team count changes: stored ticks were
    // counted against the old number, so the list must read as unpacked again.
    // Keyed only on team_count so a tick isn't clobbered by the optimistic
    // cache patch it just triggered. Runs once per team-count value, not a loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(parseChecklistState(event.checklist_state, event.team_count))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.team_count])

  function toggle(key: string) {
    setChecked((prev) => {
      const next = { ...prev }
      if (next[key]) delete next[key]
      else next[key] = true
      void saveState.mutateAsync({ teamCount, checked: next })
      return next
    })
  }

  function print() {
    document.body.classList.add('checklist-printing')
    const cleanup = () => {
      document.body.classList.remove('checklist-printing')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
  }

  const packed = rows.filter((r) => checked[r.key]).length
  const isLoading =
    eventQuery.isLoading || gameIdsQuery.isLoading || gamesQuery.isLoading || inventoryQuery.isLoading
  const error = eventQuery.error || gamesQuery.error || inventoryQuery.error

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="checklist-print-root bg-card flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-border/60 flex items-start justify-between gap-3 border-b p-5">
          <div>
            <h2 className="text-foreground text-lg font-bold">{t('events.checklist.title')}</h2>
            <p className="text-muted-foreground text-sm">
              {t('events.checklist.subtitle', { count: teamCount })}
            </p>
          </div>
          <div className="checklist-no-print flex shrink-0 items-center gap-2">
            <NeoButton type="button" variant="surface" size="sm" onClick={print}>
              <IconDownload className="size-4" /> {t('events.checklist.print')}
            </NeoButton>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('common:close')}
              onClick={onClose}
            >
              <IconClose className="size-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <QueryLoading rows={4} />
          ) : error ? (
            <QueryError message={error.message} />
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {t('events.checklist.empty')}
            </p>
          ) : (
            <>
              <p className="text-muted-foreground checklist-no-print mb-3 text-xs font-semibold">
                {t('events.checklist.packedCount', { packed, total: rows.length })}
              </p>
              <ul className="space-y-2">
                {rows.map((row) => {
                  const isChecked = Boolean(checked[row.key])
                  const isOpen = Boolean(expanded[row.key])
                  return (
                    <li key={row.key} className="border-border/70 rounded-md border">
                      <div className="flex items-center gap-3 p-3">
                        <input
                          type="checkbox"
                          className="size-5 shrink-0 accent-[var(--nm-yellow)]"
                          checked={isChecked}
                          onChange={() => toggle(row.key)}
                          aria-label={row.name}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-semibold ${isChecked ? 'text-muted-foreground line-through' : ''}`}
                          >
                            {row.name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {row.sources.some((s) => s.kind === 'store') &&
                            row.sources.every((s) => s.kind === 'store')
                              ? t('events.checklist.storeSource')
                              : row.sources.length > 1
                                ? t('events.checklist.sourcesCount', {
                                    count: row.sources.length,
                                  })
                                : row.sources[0]?.label}{' '}
                            · {t('events.checklist.perTeam', { count: row.perTeam })}
                          </p>
                        </div>
                        <span className="bg-muted rounded-full px-3 py-0.5 text-sm font-extrabold tabular-nums">
                          ×{row.total}
                        </span>
                        <button
                          type="button"
                          className="text-muted-foreground checklist-no-print hover:text-foreground shrink-0"
                          aria-label={
                            isOpen
                              ? t('events.checklist.hideSources')
                              : t('events.checklist.showSources')
                          }
                          onClick={() =>
                            setExpanded((prev) => ({ ...prev, [row.key]: !prev[row.key] }))
                          }
                        >
                          {isOpen ? (
                            <IconChevronDown className="size-4" />
                          ) : (
                            <IconChevronRight className="size-4" />
                          )}
                        </button>
                      </div>
                      {isOpen ? (
                        <ul className="border-border/60 space-y-1 border-t px-3 py-2 pl-11">
                          {row.sources.map((s, i) => (
                            <li
                              key={`${s.label}-${i}`}
                              className="text-muted-foreground flex justify-between text-xs"
                            >
                              <span>
                                {s.label}
                                {s.kind === 'store' ? ` ${t('events.checklist.storeSuffix')}` : ''}
                              </span>
                              <span className="tabular-nums">×{teamCount}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
