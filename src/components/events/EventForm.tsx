import { Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AccentButton } from '@/components/admin/AccentButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GameGroupWithItems } from '@/hooks/use-game-groups'
import type { GameRow } from '@/hooks/use-games'
import type { OrganizationRow } from '@/hooks/use-organization-settings'
import { uploadAsset } from '@/lib/storage'
import {
  addStage,
  defaultTeams,
  type EventFormValues,
} from '@/lib/event-form-utils'
import type { EventStage } from '@/types/game-config'
import { cn } from '@/lib/utils'

const BRAND_LABELS = ['Primary', 'Secondary', 'Accent'] as const

type EventFormProps = {
  organizationId: string
  values: EventFormValues
  onChange: (next: EventFormValues | ((prev: EventFormValues) => EventFormValues)) => void
  games: GameRow[]
  groups: GameGroupWithItems[]
  orgDefaults?: OrganizationRow | null
}

export function EventForm({
  organizationId,
  values,
  onChange,
  games,
  groups,
  orgDefaults,
}: EventFormProps) {
  const [gameModalOpen, setGameModalOpen] = useState(false)
  const [modalSelection, setModalSelection] = useState<string[]>([])

  const {
    name,
    eventDate,
    teamCount,
    teams,
    brandingEnabled,
    logoUrl,
    brandColors,
    selectedGameIds,
    stages,
  } = values

  const set = (patch: Partial<EventFormValues>) =>
    onChange((prev) => ({ ...prev, ...patch }))

  const selectedGames = useMemo(
    () => games.filter((g) => selectedGameIds.includes(g.id)),
    [games, selectedGameIds],
  )

  function onTeamCountChange(n: number) {
    const count = Math.max(1, Math.min(20, n))
    onChange((prev) => {
      let nextTeams = prev.teams
      if (prev.teams.length !== count) {
        if (prev.teams.length < count) {
          nextTeams = [
            ...prev.teams,
            ...defaultTeams(count - prev.teams.length).map((t, i) => ({
              ...t,
              name: `Team ${prev.teams.length + i + 1}`,
            })),
          ]
        } else {
          nextTeams = prev.teams.slice(0, count)
        }
      }
      return { ...prev, teamCount: count, teams: nextTeams }
    })
  }

  function compatibleGames(stageType: EventStage['type']) {
    if (stageType === 'break') return []
    return selectedGames.filter((g) => {
      if (stageType === 'quiz') return g.type === 'quiz'
      if (stageType === 'bingo') return g.type === 'music_bingo'
      return g.type === 'photo' || g.type === 'video'
    })
  }

  return (
    <div className="space-y-8">
      <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Label>Event name</Label>
          <Input
            value={name}
            onChange={(e) => set({ name: e.target.value })}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label>Event date & time</Label>
          <Input
            type="datetime-local"
            value={eventDate}
            onChange={(e) => set({ eventDate: e.target.value })}
            className="bg-background max-w-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>Display layout</Label>
          <select
            value={values.displayLayout}
            onChange={(e) =>
              set({
                displayLayout: e.target.value as EventFormValues['displayLayout'],
              })
            }
            className="border-input bg-background max-w-sm rounded-lg border px-3 py-2 text-sm"
          >
            <option value="rank_list">Rank List</option>
            <option value="orbit_view">Orbit View</option>
          </select>
        </div>
      </Card>

      <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Number of teams</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={teamCount}
              onChange={(e) => onTeamCountChange(Number(e.target.value))}
              className="bg-background w-24"
            />
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="border-border/80 flex items-center gap-3 rounded-lg border p-3"
            >
              <input
                type="color"
                value={team.color}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    teams: prev.teams.map((x) =>
                      x.id === team.id ? { ...x, color: e.target.value } : x,
                    ),
                  }))
                }
                className="size-10 shrink-0 cursor-pointer rounded border"
              />
              <Input
                value={team.name}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    teams: prev.teams.map((x) =>
                      x.id === team.id ? { ...x, name: e.target.value } : x,
                    ),
                  }))
                }
                className="bg-background flex-1"
              />
              <Input
                value={team.color}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    teams: prev.teams.map((x) =>
                      x.id === team.id ? { ...x, color: e.target.value } : x,
                    ),
                  }))
                }
                className="bg-background w-24 font-mono text-xs"
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={brandingEnabled}
            onChange={(e) => set({ brandingEnabled: e.target.checked })}
          />
          Custom branding for this event
        </label>
        {brandingEnabled ? (
          <>
            <Input
              type="file"
              accept="image/*"
              className="max-w-xs"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                void uploadAsset(
                  'organization-logos',
                  `${organizationId}/events/${crypto.randomUUID()}`,
                  file,
                ).then((url) => set({ logoUrl: url }))
              }}
            />
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Event logo"
                className="border-border/80 size-16 rounded-lg border object-contain"
              />
            ) : null}
            <div className="grid gap-4 sm:grid-cols-3">
              {brandColors.map((c, i) => (
                <div key={BRAND_LABELS[i]} className="space-y-2">
                  <Label>{BRAND_LABELS[i]}</Label>
                  <input
                    type="color"
                    value={c}
                    onChange={(e) => {
                      const next = [...brandColors] as [string, string, string]
                      next[i] = e.target.value
                      set({ brandColors: next })
                    }}
                    className="h-10 w-full cursor-pointer rounded border"
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Organization defaults will be used
            {orgDefaults
              ? ` (${orgDefaults.primary_color}, ${orgDefaults.secondary_color}, ${orgDefaults.accent_color}).`
              : '.'}
          </p>
        )}
      </Card>

      <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground font-semibold">Games in this event</h3>
          <Button type="button" variant="outline" onClick={() => setGameModalOpen(true)}>
            Add games
          </Button>
        </div>
        {selectedGames.length === 0 ? (
          <p className="text-muted-foreground text-sm">No games added yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {selectedGames.map((g) => (
              <li
                key={g.id}
                className="border-border/80 flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
              >
                {g.name}
                <button
                  type="button"
                  onClick={() =>
                    set({
                      selectedGameIds: selectedGameIds.filter((id) => id !== g.id),
                    })
                  }
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground font-semibold">Stages</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange((prev) => ({ ...prev, stages: addStage(prev.stages) }))}
          >
            <Plus className="size-4" />
            Add stage
          </Button>
        </div>
        {stages.map((stage) => (
          <Card key={stage.id} className="border-border/80 space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={stage.name}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    stages: prev.stages.map((x) =>
                      x.id === stage.id ? { ...x, name: e.target.value } : x,
                    ),
                  }))
                }
                className="bg-background max-w-[10rem]"
              />
              <select
                value={stage.type}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    stages: prev.stages.map((x) =>
                      x.id === stage.id
                        ? {
                            ...x,
                            type: e.target.value as EventStage['type'],
                            gameId: null,
                            gameIds: [],
                          }
                        : x,
                    ),
                  }))
                }
                className="border-input bg-background rounded-lg border px-2 py-1.5 text-sm"
              >
                <option value="open">Open</option>
                <option value="quiz">Quiz</option>
                <option value="bingo">Bingo</option>
                <option value="break">Break</option>
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={stages.length <= 1}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    stages: prev.stages.filter((x) => x.id !== stage.id),
                  }))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {stage.type === 'break' ? (
              <>
                <Input
                  placeholder="Break message"
                  value={stage.message ?? ''}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      stages: prev.stages.map((x) =>
                        x.id === stage.id ? { ...x, message: e.target.value } : x,
                      ),
                    }))
                  }
                  className="bg-background"
                />
                <Input
                  type="number"
                  placeholder="Duration (minutes)"
                  value={stage.durationMinutes ?? ''}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      stages: prev.stages.map((x) =>
                        x.id === stage.id
                          ? { ...x, durationMinutes: Number(e.target.value) }
                          : x,
                      ),
                    }))
                  }
                  className="bg-background max-w-[10rem]"
                />
              </>
            ) : stage.type === 'open' ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  Select photo or video games (multiple allowed)
                </p>
                {compatibleGames('open').map((g) => {
                  const ids = stage.gameIds ?? []
                  const checked = ids.includes(g.id)
                  return (
                    <label
                      key={g.id}
                      className="border-border/80 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onChange((prev) => ({
                            ...prev,
                            stages: prev.stages.map((x) =>
                              x.id === stage.id
                                ? {
                                    ...x,
                                    gameIds: checked
                                      ? ids.filter((id) => id !== g.id)
                                      : [...ids, g.id],
                                  }
                                : x,
                            ),
                          }))
                        }
                      />
                      {g.name}
                    </label>
                  )
                })}
              </div>
            ) : (
              <select
                value={stage.gameId ?? ''}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    stages: prev.stages.map((x) =>
                      x.id === stage.id
                        ? { ...x, gameId: e.target.value || null }
                        : x,
                    ),
                  }))
                }
                className="border-input bg-background w-full rounded-lg border px-2 py-1.5 text-sm"
              >
                <option value="">Select game…</option>
                {compatibleGames(stage.type).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </Card>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => onChange((prev) => ({ ...prev, stages: addStage(prev.stages) }))}
        >
          <Plus className="size-4" />
          Add stage
        </Button>
      </Card>

      {gameModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="border-border/80 max-h-[80vh] w-full max-w-lg overflow-auto bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-foreground font-semibold">Select games</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setGameModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setModalSelection(games.map((g) => g.id))}
              >
                Select all
              </Button>
              {groups.map((group) => (
                <Button
                  key={group.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setModalSelection(group.items.map((i) => i.game_id))
                  }
                >
                  {group.name}
                </Button>
              ))}
            </div>
            <ul className="space-y-2">
              {games.map((g) => {
                const checked = modalSelection.includes(g.id)
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      className={cn(
                        'hover:bg-muted/50 w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        checked ? 'border-[#FFCB03]/60 bg-[#FFCB03]/10' : 'border-border/80',
                      )}
                      onClick={() =>
                        setModalSelection((ids) =>
                          checked ? ids.filter((id) => id !== g.id) : [...ids, g.id],
                        )
                      }
                    >
                      {g.name}
                      <span className="text-muted-foreground ml-2 text-xs capitalize">
                        {g.type.replace('_', ' ')}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setGameModalOpen(false)}>
                Cancel
              </Button>
              <AccentButton
                type="button"
                onClick={() => {
                  set({
                    selectedGameIds: [
                      ...new Set([...selectedGameIds, ...modalSelection]),
                    ],
                  })
                  setModalSelection([])
                  setGameModalOpen(false)
                }}
              >
                {modalSelection.length > 1
                  ? `Add ${modalSelection.length} games`
                  : 'Add game'}
              </AccentButton>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
