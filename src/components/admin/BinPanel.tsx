import { RotateCcw, Trash2 } from 'lucide-react'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { daysRemaining } from '@/lib/bin'

export type BinItem = {
  id: string
  name: string
  deletedAt: string
}

export function BinPanel({
  items,
  emptyLabel,
  onRestore,
  onOpen,
  restoringId,
}: {
  items: BinItem[]
  emptyLabel: string
  onRestore: (id: string) => void
  onOpen: (id: string) => void
  restoringId?: string
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
    <div className="space-y-2">
      {items.map((item) => {
        const remaining = daysRemaining(item.deletedAt)
        return (
          <Card
            key={item.id}
            className="border-border/80 flex items-center justify-between gap-3 bg-card p-4 shadow-sm"
          >
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="text-foreground truncate text-left font-medium hover:underline"
              >
                {item.name}
              </button>
              <p className="text-muted-foreground text-xs">
                {remaining > 0
                  ? `${remaining} day${remaining === 1 ? '' : 's'} left before it's deleted for good`
                  : 'Deleting soon'}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <NeoButton type="button" variant="surface" size="sm" onClick={() => onOpen(item.id)}>
                Open
              </NeoButton>
              <NeoButton
                type="button"
                variant="surface"
                size="sm"
                disabled={restoringId === item.id}
                onClick={() => onRestore(item.id)}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Restore
              </NeoButton>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
