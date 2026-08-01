import { IconRestore, IconTrash } from '@/components/icons'
import { useState } from 'react'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { daysRemaining } from '@/lib/bin'

export type BinItem = {
  id: string
  name: string
  deletedAt: string
  /** Optional cover thumbnail, shown for games. */
  coverUrl?: string | null
  /** Game type label, e.g. "Photo". */
  typeLabel?: string | null
  /** Group names this item belonged to. */
  groups?: string[]
  /** Live display name of whoever deleted it. */
  deletedByName?: string | null
  /** True when the deleting account no longer exists. */
  deletedByRemoved?: boolean
}

function formatDeletedDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

export function BinPanel({
  items,
  emptyLabel,
  onRestore,
  onOpen,
  onDeletePermanently,
  restoringId,
  deletingId,
  selectedIds,
  onSelectedIdsChange,
}: {
  items: BinItem[]
  emptyLabel: string
  onRestore: (id: string) => Promise<void>
  onOpen: (id: string) => void
  onDeletePermanently?: (id: string) => void | Promise<void>
  restoringId?: string
  deletingId?: string
  /**
   * Controlled selection. When provided, the parent owns the set and renders the
   * bulk delete itself (Games puts it in the page header), so the panel drops
   * its own delete button to avoid two controls doing the same job.
   */
  selectedIds?: Set<string>
  onSelectedIdsChange?: (next: Set<string>) => void
}) {
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set())
  const controlled = selectedIds !== undefined
  const selected = selectedIds ?? internalSelected
  const setSelected = (updater: (current: Set<string>) => Set<string>) => {
    if (controlled) onSelectedIdsChange?.(updater(selected))
    else setInternalSelected(updater)
  }
  const [restoringBulk, setRestoringBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)

  if (items.length === 0) {
    return (
      <Card className="border-border/80 flex flex-col items-center justify-center gap-3 bg-card px-6 py-16 text-center shadow-sm">
        <IconTrash className="text-muted-foreground size-10 opacity-60" />
        <p className="text-foreground font-medium">{emptyLabel}</p>
      </Card>
    )
  }

  const restorableItems = items.filter((item) => daysRemaining(item.deletedAt) > 0)
  const selectedCount = items.filter((item) => selected.has(item.id)).length
  const allRestorableSelected =
    restorableItems.length > 0 && restorableItems.every((item) => selected.has(item.id))

  function toggleSelected(id: string) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(() =>
      allRestorableSelected
        ? new Set<string>()
        : new Set(restorableItems.map((item) => item.id)),
    )
  }

  /**
   * Permanent bulk delete. Confirmed once for the whole batch rather than per
   * item, because a per-item prompt for twenty games trains people to click
   * through without reading.
   */
  async function deleteSelectedPermanently() {
    if (!onDeletePermanently) return
    const ids = items.filter((item) => selected.has(item.id)).map((item) => item.id)
    if (ids.length === 0) return
    if (
      !window.confirm(
        `Permanently delete ${ids.length} item${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
      )
    ) {
      return
    }
    setDeletingBulk(true)
    try {
      for (const id of ids) await onDeletePermanently(id)
      setSelected(() => new Set<string>())
    } finally {
      setDeletingBulk(false)
    }
  }

  async function restoreSelected() {
    setRestoringBulk(true)
    try {
      for (const item of items) {
        if (selected.has(item.id) && daysRemaining(item.deletedAt) > 0) {
          await onRestore(item.id)
        }
      }
      setSelected(() => new Set<string>())
    } finally {
      setRestoringBulk(false)
    }
  }

  return (
    <div className="border-nm-slate-800 bg-card overflow-hidden rounded-lg border-2">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={allRestorableSelected} onChange={toggleAll} />
          Select all restorable ({restorableItems.length})
        </label>
        {selectedCount > 0 ? (
          <NeoButton type="button" variant="surface" size="sm" disabled={restoringBulk} onClick={() => void restoreSelected()}>
            <IconRestore className="mr-1.5 size-3.5" />
            {restoringBulk ? 'Restoring…' : `Restore ${selectedCount} selected`}
          </NeoButton>
        ) : null}
        {selectedCount > 0 && onDeletePermanently && !controlled ? (
          <NeoButton
            type="button"
            variant="destructive"
            size="sm"
            disabled={deletingBulk || restoringBulk}
            onClick={() => void deleteSelectedPermanently()}
          >
            <IconTrash className="mr-1.5 size-3.5" />
            {deletingBulk ? 'Deleting…' : `Delete ${selectedCount} permanently`}
          </NeoButton>
        ) : null}
      </div>
      <div className="text-muted-foreground border-border hidden grid-cols-[28px_44px_minmax(0,1fr)_90px_minmax(0,1fr)_140px_120px_100px_190px] gap-4 border-b px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] md:grid">
        <span />
        <span>Cover</span>
        <span>Name</span>
        <span>Type</span>
        <span>Groups</span>
        <span>Deleted by</span>
        <span>Deleted on</span>
        <span>Restore in</span>
        <span className="text-right">Actions</span>
      </div>
      {items.map((item) => {
        const remaining = daysRemaining(item.deletedAt)
        return (
          <div
            key={item.id}
            className="border-border/70 grid gap-3 border-b px-4 py-3 last:border-b-0 md:grid-cols-[28px_44px_minmax(0,1fr)_90px_minmax(0,1fr)_140px_120px_100px_190px] md:items-center"
          >
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              disabled={remaining <= 0 || restoringBulk}
              onChange={() => toggleSelected(item.id)}
              aria-label={`Select ${item.name}`}
            />
            <div className="hidden md:block">
              {item.coverUrl ? (
                <img
                  src={item.coverUrl}
                  alt=""
                  className="size-9 rounded object-cover"
                />
              ) : (
                <div className="bg-muted size-9 rounded" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="text-foreground truncate text-left font-medium hover:underline"
              >
                {item.name}
              </button>
              <p className="text-muted-foreground mt-0.5 text-xs md:hidden">Deleted {formatDeletedDate(item.deletedAt)}</p>
            </div>
            <p className="text-muted-foreground hidden truncate text-xs md:block">
              {item.typeLabel ?? '—'}
            </p>
            <p className="text-muted-foreground hidden truncate text-xs md:block">
              {item.groups?.length ? item.groups.join(', ') : 'Ungrouped'}
            </p>
            <p className="text-muted-foreground hidden truncate text-xs md:block">
              {/* Attribution survives the account being deleted via the
                  deleted_by_name snapshot; only pre-column rows are unknown. */}
              {item.deletedByName
                ? item.deletedByRemoved
                  ? `${item.deletedByName} (account removed)`
                  : item.deletedByName
                : 'Unknown'}
            </p>
            <p className="text-muted-foreground hidden text-xs md:block">{formatDeletedDate(item.deletedAt)}</p>
            <p className="text-muted-foreground text-xs">
              {remaining > 0 ? `${remaining} day${remaining === 1 ? '' : 's'}` : 'Deleting soon'}
            </p>
            <div className="flex shrink-0 justify-start gap-2 md:justify-end">
              <NeoButton type="button" variant="surface" size="sm" onClick={() => onOpen(item.id)}>
                Open
              </NeoButton>
              <NeoButton
                type="button"
                variant="surface"
                size="sm"
                disabled={restoringId === item.id || remaining <= 0}
                onClick={() => void onRestore(item.id)}
              >
                <IconRestore className="mr-1.5 size-3.5" />
                Restore
              </NeoButton>
              {onDeletePermanently ? (
                <NeoButton
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deletingId === item.id}
                  onClick={() => onDeletePermanently(item.id)}
                >
                  <IconTrash className="mr-1.5 size-3.5" />
                  {deletingId === item.id ? 'Deleting…' : 'Delete permanently'}
                </NeoButton>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
