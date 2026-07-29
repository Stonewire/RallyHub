import { RotateCcw, Trash2 } from 'lucide-react'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { daysRemaining } from '@/lib/bin'

export type BinItem = {
  id: string
  name: string
  deletedAt: string
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
}: {
  items: BinItem[]
  emptyLabel: string
  onRestore: (id: string) => void
  onOpen: (id: string) => void
  onDeletePermanently?: (id: string) => void
  restoringId?: string
  deletingId?: string
}) {
  if (items.length === 0) {
    return (
      <Card className="border-border/80 flex flex-col items-center justify-center gap-3 bg-card px-6 py-16 text-center shadow-sm">
        <Trash2 className="text-muted-foreground size-10 opacity-60" />
        <p className="text-foreground font-medium">{emptyLabel}</p>
      </Card>
    )
  }

  return (
    <div className="border-nm-slate-800 bg-card overflow-hidden rounded-lg border-2">
      <div className="text-muted-foreground border-border hidden grid-cols-[minmax(0,1fr)_130px_110px_250px] gap-4 border-b px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] md:grid">
        <span>Name</span>
        <span>Deleted on</span>
        <span>Delete in</span>
        <span className="text-right">Actions</span>
      </div>
      {items.map((item) => {
        const remaining = daysRemaining(item.deletedAt)
        return (
          <div
            key={item.id}
            className="border-border/70 grid gap-3 border-b px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_130px_110px_250px] md:items-center"
          >
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
                onClick={() => onRestore(item.id)}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
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
                  <Trash2 className="mr-1.5 size-3.5" />
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
