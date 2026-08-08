import { useMemo, useState } from 'react'

import { IconSearch, IconTrash } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberField } from '@/components/ui/number-field'
import { useInventoryGroups } from '@/hooks/use-inventory-groups'
import { useInventoryItems } from '@/hooks/use-inventory'
import type { EventStoreItem } from '@/types/game-config'

type EventStorePanelProps = {
  organizationId: string | null
  store: EventStoreItem[]
  onChange: (next: EventStoreItem[]) => void
}

const DEFAULT_STOCK = 10
const DEFAULT_PER_TEAM_LIMIT = 1

/**
 * The event Store: which inventory items teams can buy at this event.
 *
 * Sits beside Teams in the designer because both answer "what does this event
 * physically consist of", and both are short lists the organiser sets once.
 * Items come from the shared inventory library and are picked the same way as
 * games (group filter, search, tick several at once), so the two libraries
 * behave alike.
 */
export function EventStorePanel({ organizationId, store, onChange }: EventStorePanelProps) {
  const itemsQuery = useInventoryItems(organizationId)
  const groupsQuery = useInventoryGroups(organizationId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [groupId, setGroupId] = useState<string>('all')

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const chosenIds = useMemo(() => new Set(store.map((s) => s.itemId)), [store])

  const pickerItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      if (!item.is_active) return false
      if (term && !item.name.toLowerCase().includes(term)) return false
      if (groupId !== 'all') {
        const group = groups.find((g) => g.id === groupId)
        if (!group?.itemIds.includes(item.id)) return false
      }
      return true
    })
  }, [items, groups, search, groupId])

  function toggleItem(itemId: string) {
    if (chosenIds.has(itemId)) {
      onChange(store.filter((s) => s.itemId !== itemId))
      return
    }
    onChange([
      ...store,
      { itemId, totalStock: DEFAULT_STOCK, perTeamLimit: DEFAULT_PER_TEAM_LIMIT },
    ])
  }

  function addAllShown() {
    const additions = pickerItems
      .filter((i) => !chosenIds.has(i.id))
      .map((i) => ({
        itemId: i.id,
        totalStock: DEFAULT_STOCK,
        perTeamLimit: DEFAULT_PER_TEAM_LIMIT,
      }))
    if (additions.length > 0) onChange([...store, ...additions])
  }

  function updateRow(itemId: string, patch: Partial<EventStoreItem>) {
    onChange(store.map((s) => (s.itemId === itemId ? { ...s, ...patch } : s)))
  }

  return (
    <>
      <div className="border-border flex flex-wrap items-end gap-4 border-b pb-3">
        <div className="mr-auto">
          <h3 className="text-foreground text-base font-bold">Store</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Items teams can buy with their points during this event.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          + Add items
        </Button>
      </div>

      {store.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No items yet. Add them from your inventory library, then set how many
          you brought and how many one team may take.
        </p>
      ) : (
        <ul className="divide-border/60 divide-y">
          {store.map((row) => {
            const item = byId.get(row.itemId)
            return (
              <li key={row.itemId} className="flex items-center gap-3 py-2">
                {item?.image_url ? (
                  <img
                    src={item.image_url}
                    alt=""
                    className="size-8 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted size-8 shrink-0 rounded" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {/* An item deleted from the library still has a row here
                        until the organiser removes it. */}
                    {item?.name ?? 'Item no longer in your library'}
                  </p>
                  {item ? (
                    <p className="text-muted-foreground text-xs">{item.points_cost} points</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="text-muted-foreground text-[10px] font-semibold uppercase">
                    <span className="block">Have</span>
                    <NumberField
                      min={0}
                      value={row.totalStock}
                      onChange={(n) => updateRow(row.itemId, { totalStock: n })}
                      className="bg-background mt-0.5 h-8 w-16 text-center tabular-nums"
                    />
                  </label>
                  <label className="text-muted-foreground text-[10px] font-semibold uppercase">
                    <span className="block">Per team</span>
                    <NumberField
                      min={1}
                      value={row.perTeamLimit}
                      onChange={(n) => updateRow(row.itemId, { perTeamLimit: n })}
                      className="bg-background mt-0.5 h-8 w-16 text-center tabular-nums"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    title="Remove from store"
                    onClick={() => onChange(store.filter((s) => s.itemId !== row.itemId))}
                  >
                    <IconTrash className="size-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="border-border/80 bg-card flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border shadow-xl">
            <div className="border-border flex items-center justify-between border-b p-4">
              <h4 className="text-foreground font-bold">Add items to the store</h4>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPickerOpen(false)}>
                Done
              </Button>
            </div>
            <div className="border-border flex flex-wrap gap-2 border-b p-3">
              <div className="relative min-w-[12rem] flex-1">
                <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search items…"
                  className="bg-background h-9 pl-8"
                />
              </div>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              >
                <option value="all">All groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={addAllShown}>
                Add all shown
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {pickerItems.length === 0 ? (
                <p className="text-muted-foreground p-6 text-center text-sm">
                  No items match. Add items in the Inventory Library first.
                </p>
              ) : (
                <ul className="divide-border/60 divide-y">
                  {pickerItems.map((item) => (
                    <li key={item.id}>
                      <label className="hover:bg-muted/30 flex cursor-pointer items-center gap-3 px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={chosenIds.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                        />
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="size-9 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="bg-muted size-9 shrink-0 rounded" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="text-foreground block truncate text-sm font-semibold">
                            {item.name}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {item.points_cost} points
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

