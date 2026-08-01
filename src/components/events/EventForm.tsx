import { Check, GripVertical, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { FlipSwitch, NeoButton, SegmentedPill } from '@/components/neo-minimal'
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
import {
  ADDITIONAL_TEAM_PRICE_EUR,
  INCLUDED_TEAMS_PER_EVENT,
  additionalTeamCharge,
  formatEur,
} from '@/lib/subscription-plans'

const BRAND_LABELS = ['Primary', 'Secondary', 'Accent'] as const

/** The design caps event names so they fit the card and live display header. */
export const EVENT_NAME_MAX_LENGTH = 40

const STAGE_TYPE_OPTIONS: { value: EventStage['type']; label: string }[] = [
  { value: 'open', label: 'Quest' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'bingo', label: 'Bingo' },
  { value: 'break', label: 'Break' },
]

const BRAND_COLOR_HELP: Record<(typeof BRAND_LABELS)[number], string> = {
  Primary: 'Animated brand blobs on team join and display screens.',
  Secondary: 'Base background behind the live gradient (join + display).',
  Accent:
    'Buttons, challenge cards, chat actions, and notification accents on team devices.',
}

type EventFormProps = {
  organizationId: string
  storageKey?: string
  values: EventFormValues
  onChange: (next: EventFormValues | ((prev: EventFormValues) => EventFormValues)) => void
  games: GameRow[]
  groups: GameGroupWithItems[]
  orgDefaults?: OrganizationRow | null
  maxTeamCount?: number
}

export function EventForm({
  organizationId,
  storageKey,
  values,
  onChange,
  games,
  groups,
  orgDefaults,
  maxTeamCount = 20,
}: EventFormProps) {
  // Demo events are capped below the normal allowance, so the floor has to
  // give way rather than fight the cap.
  const minTeamCount = Math.min(INCLUDED_TEAMS_PER_EVENT, maxTeamCount)
  const { notify } = useNotification()
  const [gameModalOpen, setGameModalOpen] = useState(false)
  const [modalSelection, setModalSelection] = useState<string[]>([])
  const [modalGroupFilter, setModalGroupFilter] = useState<string>('all')
  // New-event forms do not have a database id yet. Keep one stable upload
  // folder for the lifetime of the form so superseded logo uploads can still
  // be removed together when that event is permanently deleted.
  const [newEventStorageKey] = useState(() => crypto.randomUUID())
  const brandingStorageKey = storageKey ?? newEventStorageKey
  const teamCharge = additionalTeamCharge(values.teamCount)

  const {
    name,
    eventDate,
    teamCount,
    teams,
    brandingEnabled,
    inventoryEnabled,
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

  const modalGames = useMemo(() => {
    if (modalGroupFilter === 'all') return games
    const groupGameIds = new Set(
      groups.find((group) => group.id === modalGroupFilter)?.items.map((i) => i.game_id) ?? [],
    )
    return games.filter((g) => groupGameIds.has(g.id))
  }, [games, groups, modalGroupFilter])

  const modalAvailableGameIds = useMemo(
    () => modalGames.filter((g) => !selectedGameIds.includes(g.id)).map((g) => g.id),
    [modalGames, selectedGameIds],
  )

  function onTeamCountChange(n: number) {
    const count = Math.max(minTeamCount, Math.min(maxTeamCount, n))
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
      return g.type === 'photo' || g.type === 'video' || g.type === 'text' || g.type === 'puzzle'
    })
  }

  function setStageType(stageId: string, type: EventStage['type']) {
    onChange((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? { ...stage, type, gameId: null, gameIds: [] }
          : stage,
      ),
    }))
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card p-5 shadow-sm sm:p-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:gap-10">
          <div className="space-y-4">
            <div className="border-border border-b pb-2">
              <h2 className="text-foreground text-base font-bold">Primary</h2>
              <p className="text-muted-foreground mt-1 text-xs">Event identity, schedule, and live display settings.</p>
            </div>
            <div className="space-y-2">
              <Label>
                Event name{' '}
                <span className="text-muted-foreground font-normal">
                  (max {EVENT_NAME_MAX_LENGTH} characters)
                </span>
              </Label>
              <Input
                value={name}
                maxLength={EVENT_NAME_MAX_LENGTH}
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
              <Label>Location</Label>
              <Input
                value={values.location}
                onChange={(e) => set({ location: e.target.value })}
                placeholder="e.g. Valletta, MT"
                className="bg-background"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TogglePair
                label="Display"
                leftLabel="Rank list"
                rightLabel="Orbit"
                rightSelected={values.displayLayout === 'orbit_view'}
                onChange={(rightSelected) => set({ displayLayout: rightSelected ? 'orbit_view' : 'rank_list' })}
              />
              <TogglePair
                label="UI colour"
                leftLabel="White"
                rightLabel="Black"
                rightSelected={values.displayTextColor === 'black'}
                onChange={(rightSelected) => set({ displayTextColor: rightSelected ? 'black' : 'white' })}
              />
              <TogglePair
                label="Purchase items"
                leftLabel="Off"
                rightLabel="On"
                rightSelected={inventoryEnabled}
                onChange={(rightSelected) => set({ inventoryEnabled: rightSelected })}
              />
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Display and colour settings apply to the live host, audience, and player surfaces.
            </p>
          </div>

          <div className="space-y-4">
            <div className="border-border border-b pb-2">
              <h2 className="text-foreground text-base font-bold">Branding</h2>
              <p className="text-muted-foreground mt-1 text-xs">Optional visual overrides for this event.</p>
            </div>
            <TogglePair
              label="Custom event branding"
              leftLabel="Off"
              rightLabel="On"
              rightSelected={brandingEnabled}
              onChange={(rightSelected) => set({ brandingEnabled: rightSelected })}
            />
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
                      `${organizationId}/events/${brandingStorageKey}/${crypto.randomUUID()}`,
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
                <div className="grid gap-3 sm:grid-cols-3">
                  {brandColors.map((c, i) => (
                    <div key={BRAND_LABELS[i]} className="space-y-1.5 text-center">
                      <Label>{BRAND_LABELS[i]}</Label>
                      <input
                        type="color"
                        value={c}
                        aria-label={`${BRAND_LABELS[i]} colour`}
                        onChange={(e) => {
                          const next = [...brandColors] as [string, string, string]
                          next[i] = e.target.value
                          set({ brandColors: next })
                        }}
                        className="mx-auto block size-9 cursor-pointer rounded-full border-0 bg-transparent p-0"
                      />
                      <Input
                        value={c}
                        maxLength={7}
                        aria-label={`${BRAND_LABELS[i]} hex value`}
                        onChange={(e) => {
                          const next = [...brandColors] as [string, string, string]
                          next[i] = e.target.value
                          set({ brandColors: next })
                        }}
                        className="bg-background h-7 px-1 text-center font-mono text-[10px] uppercase"
                      />
                      <p className="sr-only">{BRAND_COLOR_HELP[BRAND_LABELS[i]]}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-end justify-center gap-4 pt-1">
                  <div className="min-w-0 flex-1">
                    <div
                      className="border-border flex aspect-video items-center justify-center overflow-hidden rounded-md border"
                      style={{ background: `linear-gradient(135deg, ${brandColors[0]}, ${brandColors[1]} 55%, ${brandColors[2]})` }}
                    >
                      {logoUrl ? <img src={logoUrl} alt="" className="max-h-10 max-w-24 object-contain" /> : <span className="px-2 text-center text-xs font-bold text-white drop-shadow">{name || 'Event preview'}</span>}
                    </div>
                    <p className="text-muted-foreground mt-1 text-center text-[10px]">Host / TV</p>
                  </div>
                  <div className="w-16 shrink-0">
                    <div
                      className="border-border flex aspect-[9/16] items-center justify-center overflow-hidden rounded-md border"
                      style={{ background: `linear-gradient(160deg, ${brandColors[0]}, ${brandColors[1]} 55%, ${brandColors[2]})` }}
                    >
                      <span className="px-1 text-center text-[8px] font-bold text-white drop-shadow">{name || 'Event'}</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-center text-[10px]">Player</p>
                  </div>
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

      <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm sm:p-6">
        <div className="border-border flex flex-wrap items-end gap-4 border-b pb-3">
          <div className="mr-auto">
            <h3 className="text-foreground text-base font-bold">Teams</h3>
            <p className="text-muted-foreground mt-1 text-xs">Set team names and colours for the live event.</p>
          </div>
          <div className="space-y-2">
            <Label>
              Number of teams{' '}
              <span className="text-muted-foreground font-normal">
                (minimum {minTeamCount})
              </span>
            </Label>
            <div className="flex items-center gap-1.5">
              <Button type="button" size="icon-sm" variant="outline" disabled={teamCount <= minTeamCount} onClick={() => onTeamCountChange(teamCount - 1)}>−</Button>
              <Input type="number" min={minTeamCount} max={maxTeamCount} value={teamCount} onChange={(e) => onTeamCountChange(Number(e.target.value))} className="bg-background h-8 w-16 text-center tabular-nums" />
              <Button type="button" size="icon-sm" variant="outline" disabled={teamCount >= maxTeamCount} onClick={() => onTeamCountChange(teamCount + 1)}>+</Button>
            </div>
          </div>
          {maxTeamCount <= 2 ? (
            <p className="text-muted-foreground text-xs">
              Demo events are limited to {maxTeamCount} teams.
            </p>
          ) : null}
        </div>
        {maxTeamCount > 2 ? (
          teamCharge.count > 0 ? (
            <div className="border-primary/40 bg-primary/5 rounded-lg border px-4 py-3 text-sm">
              <p className="text-foreground font-medium">
                Additional-team charge: {formatEur(teamCharge.amountEur)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Five teams are included. {teamCharge.count} additional team
                {teamCharge.count === 1 ? '' : 's'} × {formatEur(ADDITIONAL_TEAM_PRICE_EUR)} will
                be added automatically to this event's bill when it is activated.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Five teams are included. Each additional team costs {formatEur(ADDITIONAL_TEAM_PRICE_EUR)}
              {' '}and is added to the event bill on activation.
            </p>
          )
        ) : null}
        <ul className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="border-border/80 bg-background flex items-center gap-3 rounded-md border p-3"
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

      <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-base font-bold">Games</h3>
            <p className="text-muted-foreground mt-1 text-xs">Your event library. Stages below decide when each game appears.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setModalSelection([])
              setModalGroupFilter('all')
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
                className="border-border/80 bg-background flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
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

      <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-base font-bold">Stages</h3>
            <p className="text-muted-foreground mt-1 text-xs">Build the running order for facilitators and players.</p>
          </div>
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
        {stages.map((stage, stageIndex) => (
          <Card key={stage.id} className="border-border/80 bg-background space-y-3 rounded-md p-4 shadow-none">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.1em]">Stage {stageIndex + 1}</span>
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
                className="bg-background h-8 min-w-40 flex-1 text-sm font-semibold"
              />
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
            <SegmentedPill
              aria-label="Stage type"
              options={STAGE_TYPE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              value={stage.type}
              onChange={(next) => setStageType(stage.id, next)}
            />
            {stage.type === 'break' ? (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-end">
                <label className="space-y-1.5 text-xs font-medium">
                  <span>Break message</span>
                  <textarea
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
                  rows={2}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  />
                </label>
                <div className="space-y-1.5 text-xs font-medium">
                  <span className="text-muted-foreground block text-[10px] font-semibold tracking-wider uppercase">
                    Duration
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      aria-label="Break minutes"
                      value={stage.durationMinutes ?? ''}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          stages: prev.stages.map((x) =>
                            x.id === stage.id
                              ? { ...x, durationMinutes: Math.max(0, Number(e.target.value) || 0) }
                              : x,
                          ),
                        }))
                      }
                      className="bg-background w-16 text-center tabular-nums"
                    />
                    <span className="text-muted-foreground">min</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      aria-label="Break seconds"
                      value={stage.durationSeconds ?? ''}
                      onChange={(e) =>
                        onChange((prev) => ({
                          ...prev,
                          stages: prev.stages.map((x) =>
                            x.id === stage.id
                              ? {
                                  ...x,
                                  // Clamp to 0-59: anything more belongs in minutes.
                                  durationSeconds: Math.min(
                                    59,
                                    Math.max(0, Number(e.target.value) || 0),
                                  ),
                                }
                              : x,
                          ),
                        }))
                      }
                      className="bg-background w-16 text-center tabular-nums"
                    />
                    <span className="text-muted-foreground">sec</span>
                  </div>
                </div>
              </div>
            ) : stage.type === 'open' ? (
              <QuestStageGames
                stage={stage}
                groups={groups}
                compatible={selectedGames.filter(
                  (g) =>
                    g.type === 'photo' ||
                    g.type === 'video' ||
                    g.type === 'text' ||
                    g.type === 'puzzle',
                )}
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
          <Card className="border-nm-slate-800 max-h-[80vh] w-full max-w-lg overflow-auto bg-card p-6 shadow-xl border-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-foreground font-semibold">Select games</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setModalGroupFilter('all')
                  setGameModalOpen(false)
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={modalGroupFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setModalGroupFilter('all')}
              >
                All games
              </Button>
              {groups.map((group) => (
                <Button
                  key={group.id}
                  type="button"
                  size="sm"
                  variant={modalGroupFilter === group.id ? 'default' : 'outline'}
                  onClick={() => setModalGroupFilter(group.id)}
                >
                  {group.name}
                </Button>
              ))}
            </div>
            <div className="mb-4">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={modalAvailableGameIds.length === 0}
                onClick={() => setModalSelection(modalAvailableGameIds)}
              >
                {modalGroupFilter === 'all'
                  ? 'Select all'
                  : `Select all in ${groups.find((g) => g.id === modalGroupFilter)?.name ?? 'group'}`}
              </Button>
            </div>
            {modalGames.length === 0 ? (
              <p className="text-muted-foreground text-sm">No games in this group.</p>
            ) : null}
            <ul className="space-y-2">
              {modalGames.map((g) => {
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setModalGroupFilter('all')
                  setGameModalOpen(false)
                }}
              >
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

/** Two-state control, rendered as the design's sliding flip switch. */
function TogglePair({
  label,
  leftLabel,
  rightLabel,
  rightSelected,
  onChange,
}: {
  label: string
  leftLabel: string
  rightLabel: string
  rightSelected: boolean
  onChange: (rightSelected: boolean) => void
}) {
  return (
    <FlipSwitch
      caption={label}
      offValue="left"
      onValue="right"
      offLabel={leftLabel}
      onLabel={rightLabel}
      value={rightSelected ? 'right' : 'left'}
      onChange={(next) => onChange(next === 'right')}
    />
  )
}

type QuestTypeFilter = 'photo' | 'video' | 'puzzle' | 'text' | null

const QUEST_TYPE_FILTERS: { label: string; type: QuestTypeFilter }[] = [
  { label: 'All', type: null },
  { label: 'Photo', type: 'photo' },
  { label: 'Video', type: 'video' },
  { label: 'Puzzle', type: 'puzzle' },
  { label: 'Text', type: 'text' },
]

type QuestStageGamesProps = {
  stage: EventStage
  groups: GameGroupWithItems[]
  /** Photo/video/text/puzzle games already added to the event. */
  compatible: GameRow[]
  onChange: EventFormProps['onChange']
}

/** Quest stage games: ordered draggable list (= players' display order) + quick add. */
function QuestStageGames({ stage, groups, compatible, onChange }: QuestStageGamesProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [groupFilter, setGroupFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<QuestTypeFilter>(null)
  // Checked-but-unsaved picks. The design stages a selection and commits it on
  // Save, rather than the previous behaviour of adding on every single click.
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen] = useState((stage.gameIds ?? []).length === 0)

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
  const filteredAvailable = useMemo(() => {
    let list = available
    if (groupFilter !== 'all') {
      const gameIds = new Set(
        groups.find((group) => group.id === groupFilter)?.items.map((item) => item.game_id) ?? [],
      )
      list = list.filter((game) => gameIds.has(game.id))
    }
    if (typeFilter) list = list.filter((game) => game.type === typeFilter)
    return list
  }, [available, groupFilter, groups, typeFilter])

  const allFilteredChecked =
    filteredAvailable.length > 0 && filteredAvailable.every((g) => pending.has(g.id))

  function togglePending(id: string) {
    setPending((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  /**
   * Moves everything currently checked into the stage. Called by Save and also
   * whenever a filter changes, so a partly-made selection is never dropped
   * silently just because the organiser looked at a different group or type.
   */
  function commitPending() {
    if (pending.size === 0) return
    const toAdd = [...pending].filter((id) => !ids.includes(id))
    setPending(new Set())
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
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          No games in this stage yet — add photo, video, text, or puzzle games below.
        </p>
      )}

      {inStage.length > 0 && !pickerOpen && available.length > 0 ? (
        <NeoButton type="button" variant="surface" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="size-3.5" />
          Add More
        </NeoButton>
      ) : null}

      {pickerOpen || inStage.length === 0 ? (
        <div className="border-border/70 space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={groupFilter}
              onChange={(event) => {
                // Committing first means a half-made selection is never lost
                // just because the organiser went looking in another group.
                commitPending()
                setGroupFilter(event.target.value)
              }}
              className="border-input bg-background h-8 min-w-40 rounded-md border px-2 text-xs font-semibold"
              aria-label="Filter available quest games by group"
            >
              <option value="all">All Groups</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={filteredAvailable.length === 0}
              onClick={() =>
                setPending(
                  allFilteredChecked
                    ? new Set()
                    : new Set(filteredAvailable.map((g) => g.id)),
                )
              }
            >
              {allFilteredChecked ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUEST_TYPE_FILTERS.map(({ label, type }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  commitPending()
                  setTypeFilter(type)
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  typeFilter === type
                    ? 'bg-nm-yellow text-nm-charcoal'
                    : 'border-border text-muted-foreground hover:bg-muted/50 border',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredAvailable.length > 0 ? (
            <>
              <ul className="border-border/70 max-h-64 divide-y overflow-y-auto rounded-md border">
                {filteredAvailable.map((g) => (
                  <li key={g.id}>
                    <label className="hover:bg-muted/40 flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={pending.has(g.id)}
                        onChange={() => togglePending(g.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{g.name}</span>
                      <span className="text-muted-foreground shrink-0 text-xs capitalize">
                        {g.type === 'music_bingo' ? 'Bingo' : g.type}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">
                <NeoButton
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={pending.size === 0}
                  onClick={() => {
                    commitPending()
                    setPickerOpen(false)
                  }}
                >
                  Save{pending.size > 0 ? ` (${pending.size})` : ''}
                </NeoButton>
              </div>
            </>
          ) : available.length > 0 ? (
            <p className="text-muted-foreground text-xs">No available games match these filters.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
