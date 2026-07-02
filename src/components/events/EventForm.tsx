import { Check, GripVertical, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNotification } from '@/contexts/notification-context'
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

const BRAND_COLOR_HELP: Record<(typeof BRAND_LABELS)[number], string> = {
  Primary: 'Animated brand blobs on team join and display screens.',
  Secondary: 'Base background behind the live gradient (join + display).',
  Accent:
    'Buttons, challenge cards, chat actions, and notification accents on team devices.',
}

type EventFormProps = {
  organizationId: string
  values: EventFormValues
  onChange: (next: EventFormValues | ((prev: EventFormValues) => EventFormValues)) => void
  games: GameRow[]
  groups: GameGroupWithItems[]
  orgDefaults?: OrganizationRow | null
  maxTeamCount?: number
}

export function EventForm({
  organizationId,
  values,
  onChange,
  games,
  groups,
  orgDefaults,
  maxTeamCount = 20,
}: EventFormProps) {
  const { notify } = useNotification()
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

  const availableGameIds = useMemo(
    () => games.filter((g) => !selectedGameIds.includes(g.id)).map((g) => g.id),
    [games, selectedGameIds],
  )

  function onTeamCountChange(n: number) {
    const count = Math.max(1, Math.min(maxTeamCount, n))
    onChange((prev) => {
      let nextTeams = prev.teams
      if (prev.teams.length !== count) {
        if (prev.teams.length < count) {
          // Generate the full set so appended teams keep the cycling color
          // offset (slicing from prev length); calling defaultTeams() with just
          // the delta restarted colors at index 0 — every added team came out red.
          nextTeams = [...prev.teams, ...defaultTeams(count).slice(prev.teams.length)]
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
      return g.type === 'photo' || g.type === 'video' || g.type === 'text'
    })
  }

  return (
    <div className="space-y-8">
      <Card className="border-border/80 bg-card p-6 shadow-sm">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-4">
            <h2 className="text-foreground text-lg font-semibold">Event details</h2>
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
        <div className="space-y-2">
          <Label>Live UI text color</Label>
          <select
            value={values.displayTextColor}
            onChange={(e) =>
              set({
                displayTextColor: e.target.value as EventFormValues['displayTextColor'],
              })
            }
            className="border-input bg-background max-w-sm rounded-lg border px-3 py-2 text-sm"
          >
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
          <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
            Controls title and score readability on top of your event background (not button
            colors).             Use white on dark palettes; black on light secondary colors.
          </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-foreground text-lg font-semibold">Event branding</h2>
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
                <p className="text-muted-foreground text-sm">
                  Override your organization profile for this event only.
                </p>
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
                      { mediaKind: 'logo' },
                    )
                      .then((url) => set({ logoUrl: url }))
                      .catch((err) =>
                        notify(
                          err instanceof Error ? err.message : 'Could not upload logo',
                        ),
                      )
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
                      <p className="text-muted-foreground text-xs leading-snug">
                        {BRAND_COLOR_HELP[BRAND_LABELS[i]]}
                      </p>
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
            ) : orgDefaults ? (
              <p className="text-muted-foreground text-sm">
                Using organization logo and colors from Settings.
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Number of teams</Label>
            <Input
              type="number"
              min={1}
              max={maxTeamCount}
              value={teamCount}
              onChange={(e) => onTeamCountChange(Number(e.target.value))}
              className="bg-background w-24"
            />
          </div>
          {maxTeamCount <= 2 ? (
            <p className="text-muted-foreground text-xs">
              Demo events are limited to {maxTeamCount} teams.
            </p>
          ) : null}
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
              {teams.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive shrink-0"
                  title="Remove team"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      teamCount: Math.max(1, prev.teamCount - 1),
                      teams: prev.teams.filter((x) => x.id !== team.id),
                    }))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground font-semibold">Games in this event</h3>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setModalSelection([])
              setGameModalOpen(true)
            }}
          >
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
                <option value="open">Quest</option>
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
              <QuestStageGames
                stage={stage}
                compatible={compatibleGames('open')}
                onChange={onChange}
              />
            ) : (
              <select
                value={stage.gameId ?? ''}
                onChange={(e) => {
                  const gameId = e.target.value || null
                  onChange((prev) => {
                    const nextIds = gameId
                      ? [...new Set([...prev.selectedGameIds, gameId])]
                      : prev.selectedGameIds
                    return {
                      ...prev,
                      selectedGameIds: nextIds,
                      stages: prev.stages.map((x) =>
                        x.id === stage.id ? { ...x, gameId } : x,
                      ),
                    }
                  })
                }}
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
                disabled={availableGameIds.length === 0}
                onClick={() => setModalSelection(availableGameIds)}
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
                    setModalSelection(
                      group.items
                        .map((i) => i.game_id)
                        .filter((id) => !selectedGameIds.includes(id)),
                    )
                  }
                >
                  {group.name}
                </Button>
              ))}
            </div>
            <ul className="space-y-2">
              {games.map((g) => {
                const alreadyAdded = selectedGameIds.includes(g.id)
                const checked = modalSelection.includes(g.id)
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      disabled={alreadyAdded}
                      className={cn(
                        'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        alreadyAdded
                          ? 'border-border/60 bg-muted/30 cursor-not-allowed opacity-60'
                          : checked
                            ? 'border-[#FFC107]/60 bg-[#FFC107]/10 hover:bg-muted/50'
                            : 'border-border/80 hover:bg-muted/50',
                      )}
                      onClick={() => {
                        if (alreadyAdded) return
                        setModalSelection((ids) =>
                          checked ? ids.filter((id) => id !== g.id) : [...ids, g.id],
                        )
                      }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span>
                          {g.name}
                          <span className="text-muted-foreground ml-2 text-xs capitalize">
                            {g.type.replace('_', ' ')}
                          </span>
                        </span>
                        {alreadyAdded ? (
                          <span
                            className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs font-medium"
                          >
                            <Check className="size-3.5" />
                            Added
                          </span>
                        ) : null}
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
              <NeoButton
                type="button"
                variant="primary"
                disabled={modalSelection.length === 0}
                onClick={() => {
                  const newIds = modalSelection.filter(
                    (id) => !selectedGameIds.includes(id),
                  )
                  if (newIds.length === 0) return
                  set({
                    selectedGameIds: [...new Set([...selectedGameIds, ...newIds])],
                  })
                  setModalSelection([])
                  setGameModalOpen(false)
                }}
              >
                {modalSelection.length > 1
                  ? `Add ${modalSelection.length} games`
                  : 'Add game'}
              </NeoButton>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

const QUEST_QUICK_FILTERS = [
  { label: 'All', type: null },
  { label: 'All photo', type: 'photo' },
  { label: 'All video', type: 'video' },
  { label: 'All text', type: 'text' },
] as const

type QuestStageGamesProps = {
  stage: EventStage
  /** Photo/video/text games already in the event library. */
  compatible: GameRow[]
  onChange: EventFormProps['onChange']
}

/** Quest stage games: ordered draggable list (= players' display order) + quick add. */
function QuestStageGames({ stage, compatible, onChange }: QuestStageGamesProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const ids = useMemo(() => stage.gameIds ?? [], [stage.gameIds])
  const inStage = useMemo(
    () =>
      ids
        .map((id) => compatible.find((g) => g.id === id))
        .filter((g): g is GameRow => g != null),
    [ids, compatible],
  )
  const available = useMemo(
    () => compatible.filter((g) => !ids.includes(g.id)),
    [compatible, ids],
  )

  // Adding always unions into the event library too (same rule as before).
  function setStageIds(nextIds: string[], addedIds: string[] = []) {
    onChange((prev) => ({
      ...prev,
      selectedGameIds: [...new Set([...prev.selectedGameIds, ...addedIds])],
      stages: prev.stages.map((x) =>
        x.id === stage.id ? { ...x, gameIds: nextIds } : x,
      ),
    }))
  }

  function quickAdd(type: (typeof QUEST_QUICK_FILTERS)[number]['type']) {
    const toAdd = available.filter((g) => type == null || g.type === type).map((g) => g.id)
    if (toAdd.length === 0) return
    setStageIds([...ids, ...toAdd], toAdd)
  }

  function moveTo(from: number, to: number) {
    if (from === to) return
    const next = [...ids]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setStageIds(next)
  }

  return (
    <div className="space-y-3">
      {inStage.length > 0 ? (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">
            Drag to reorder — this is the order players see the challenges in.
          </p>
          <ul className="space-y-1.5">
            {inStage.map((g, index) => (
              <li
                key={g.id}
                draggable
                onDragStart={(e) => {
                  setDragIndex(index)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', g.id)
                }}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIndex != null) moveTo(dragIndex, index)
                  setDragIndex(null)
                }}
                className={cn(
                  'border-border/80 bg-background flex cursor-grab items-center gap-2 rounded-lg border px-3 py-2 text-sm active:cursor-grabbing',
                  dragIndex === index ? 'opacity-50' : '',
                )}
              >
                <GripVertical className="text-muted-foreground size-4 shrink-0" />
                <span className="text-muted-foreground w-5 shrink-0 text-xs tabular-nums">
                  {index + 1}.
                </span>
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs capitalize">
                  {g.type}
                </span>
                <button
                  type="button"
                  title="Remove from stage"
                  onClick={() => setStageIds(ids.filter((id) => id !== g.id))}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          No games in this stage yet — add photo, video, or text games below.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {QUEST_QUICK_FILTERS.map(({ label, type }) => {
          const count = available.filter((g) => type == null || g.type === type).length
          return (
            <Button
              key={label}
              type="button"
              size="sm"
              variant="outline"
              disabled={count === 0}
              onClick={() => quickAdd(type)}
            >
              {label}
              {count > 0 ? ` (${count})` : ''}
            </Button>
          )
        })}
      </div>

      {available.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {available.map((g) => (
            <button
              key={g.id}
              type="button"
              className="border-border/80 hover:bg-muted/50 flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
              onClick={() => setStageIds([...ids, g.id], [g.id])}
            >
              <Plus className="size-3" />
              {g.name}
              <span className="text-muted-foreground text-xs capitalize">{g.type}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
