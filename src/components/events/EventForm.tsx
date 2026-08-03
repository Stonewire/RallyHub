import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconGrip,
  IconPlus,
  IconTrash,
} from '@/components/icons'
import { useMemo, useState } from 'react'

import { NeoButton, SegmentedPill } from '@/components/neo-minimal'
import { AssetField } from '@/components/games/AssetField'
import { BrandColourPicker } from '@/components/admin/BrandColourPicker'
import { EventPreviewModal } from '@/components/events/EventPreviewModal'
import { IconEye } from '@/components/icons'
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
  moveStage,
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
  // New-event forms do not have a database id yet. Keep one stable upload
  // folder for the lifetime of the form so superseded logo uploads can still
  // be removed together when that event is permanently deleted.
  const [newEventStorageKey] = useState(() => crypto.randomUUID())
  const [previewOpen, setPreviewOpen] = useState(false)
  // Collapsed stages, keyed by stage id. Local to the editing session: which
  // stage you are working on is not worth persisting.
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({})
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
    stages,
  } = values

  const set = (patch: Partial<EventFormValues>) =>
    onChange((prev) => ({ ...prev, ...patch }))

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

  /**
   * Stage pickers draw from the ORGANISATION's whole library. The design
   * removed the old two-step model (add games to the event, then pick from
   * those); picking a game in a stage is what adds it to the event.
   */
  function compatibleGames(stageType: EventStage['type']) {
    if (stageType === 'break') return []
    return games.filter((g) => {
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
      <EventPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        name={name}
        logoUrl={logoUrl}
        brandColors={brandColors}
        brandingEnabled={brandingEnabled}
        displayLayout={values.displayLayout}
        displayTextColor={values.displayTextColor}
        teams={teams}
      />
      {/* Two cards side by side, matching the game editors: settings on the
          left, the look of the event on the right. */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm sm:p-6">
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
            <PillPair
              label="Display"
              leftLabel="Rank list"
              rightLabel="Orbit"
              rightSelected={values.displayLayout === 'orbit_view'}
              onChange={(rightSelected) => set({ displayLayout: rightSelected ? 'orbit_view' : 'rank_list' })}
            />
            <PillPair
              label="UI colour"
              leftLabel="White"
              rightLabel="Black"
              rightSelected={values.displayTextColor === 'black'}
              onChange={(rightSelected) => set({ displayTextColor: rightSelected ? 'black' : 'white' })}
            />
            <PillPair
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
        </Card>

        <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm sm:p-6">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-2">
            <div>
              <h2 className="text-foreground text-base font-bold">Branding</h2>
              <p className="text-muted-foreground mt-1 text-xs">Optional visual overrides for this event.</p>
            </div>
            <PillPair
              label="Custom branding"
              leftLabel="Off"
              rightLabel="On"
              rightSelected={brandingEnabled}
              onChange={(rightSelected) => set({ brandingEnabled: rightSelected })}
            />
          </div>
          {brandingEnabled ? (
            <>
              {/* Upload only, with the logo shown beside the button: a logo is
                  a file the organiser has, never a URL they type. */}
              <AssetField
                label="Event logo"
                inlinePreview
                preview={logoUrl}
                onFile={async (file) => {
                  if (!file) return
                  const url = await uploadAsset(
                    'organization-logos',
                    `${organizationId}/events/${brandingStorageKey}/${crypto.randomUUID()}`,
                    file,
                    { mediaKind: 'logo' },
                  )
                  set({ logoUrl: url })
                }}
              />
              {/* Each colour says what it actually paints, because "secondary"
                  means nothing until you know it is the base behind the blobs. */}
              <div className="space-y-3">
                {brandColors.map((c, i) => (
                  <div key={BRAND_LABELS[i]} className="flex items-center gap-3">
                    <div className="w-20 shrink-0">
                      <BrandColourPicker
                        id={`event-brand-${i}`}
                        label={BRAND_LABELS[i]}
                        value={c}
                        onChange={(hex) => {
                          const next = [...brandColors] as [string, string, string]
                          next[i] = hex
                          set({ brandColors: next })
                        }}
                      />
                    </div>
                    <p className="text-muted-foreground min-w-0 flex-1 text-xs leading-relaxed">
                      {BRAND_COLOR_HELP[BRAND_LABELS[i]]}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : orgDefaults ? (
            <p className="text-muted-foreground text-sm">
              Using organization logo and colors from Settings.
            </p>
          ) : null}
          <NeoButton
            type="button"
            variant="surface"
            size="sm"
            className="mt-auto w-full justify-center"
            onClick={() => setPreviewOpen(true)}
          >
            <IconEye className="size-3.5" aria-hidden />
            Preview event
          </NeoButton>
        </Card>
      </div>

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
        {/* One team per line, full width: a colour, a name with room to be a
            real name, and the join code where the eye ends up. */}
        <ul className="divide-border/60 divide-y">
          {teams.map((team, index) => (
            <li key={team.id} className="flex items-center gap-3 py-2">
              <input
                type="color"
                value={team.color}
                aria-label={`${team.name || `Team ${index + 1}`} colour`}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    teams: prev.teams.map((x) =>
                      x.id === team.id ? { ...x, color: e.target.value } : x,
                    ),
                  }))
                }
                className="size-7 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
              />
              <Input
                value={team.name}
                placeholder={`Team ${index + 1}`}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    teams: prev.teams.map((x) =>
                      x.id === team.id ? { ...x, name: e.target.value } : x,
                    ),
                  }))
                }
                className="bg-background h-8 min-w-0 flex-1"
              />
              {/* Slot, not a join code: teams share one event join link and
                  claim a slot, so there is no per-team code to show. */}
              <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                #{index + 1}
              </span>
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
                  <IconTrash className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
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
            <IconPlus className="size-4" />
            Add stage
          </Button>
        </div>
        {stages.map((stage, stageIndex) => (
          <Card key={stage.id} className="border-border/80 bg-background space-y-3 rounded-md p-4 shadow-none">
            <div className="flex flex-wrap items-center gap-3">
              {/* A long event is a long page. Collapsing a finished stage keeps
                  the one being edited on screen. */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={
                  collapsedStages[stage.id]
                    ? `Expand ${stage.name || `stage ${stageIndex + 1}`}`
                    : `Collapse ${stage.name || `stage ${stageIndex + 1}`}`
                }
                onClick={() =>
                  setCollapsedStages((current) => ({
                    ...current,
                    [stage.id]: !current[stage.id],
                  }))
                }
              >
                {collapsedStages[stage.id] ? (
                  <IconChevronRight className="size-4" />
                ) : (
                  <IconChevronDown className="size-4" />
                )}
              </Button>
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
              {/* Running order changes constantly while planning, and
                  rebuilding a stage just to move it was the only way. */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${stage.name || `stage ${stageIndex + 1}`} earlier`}
                disabled={stageIndex === 0}
                onClick={() => onChange((prev) => ({ ...prev, stages: moveStage(prev.stages, stageIndex, -1) }))}
              >
                <IconArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move ${stage.name || `stage ${stageIndex + 1}`} later`}
                disabled={stageIndex === stages.length - 1}
                onClick={() => onChange((prev) => ({ ...prev, stages: moveStage(prev.stages, stageIndex, 1) }))}
              >
                <IconArrowDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${stage.name || `stage ${stageIndex + 1}`}`}
                disabled={stages.length <= 1}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    stages: prev.stages.filter((x) => x.id !== stage.id),
                  }))
                }
              >
                <IconTrash className="size-4" />
              </Button>
            </div>
            {collapsedStages[stage.id] ? null : (
            <>
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
            </>
            )}
          </Card>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => onChange((prev) => ({ ...prev, stages: addStage(prev.stages) }))}
        >
          <IconPlus className="size-4" />
          Add stage
        </Button>
      </Card>

    </div>
  )
}

/** Two-state control, rendered as a pill like every other choice in the app. */
function PillPair({
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
    <div className="space-y-1.5">
      <span className="text-nm-neutral-500 block text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </span>
      <SegmentedPill
        size="sm"
        aria-label={label}
        options={[
          { value: 'left', label: leftLabel },
          { value: 'right', label: rightLabel },
        ]}
        value={rightSelected ? 'right' : 'left'}
        onChange={(next) => onChange(next === 'right')}
      />
    </div>
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
  const [selectedInStage, setSelectedInStage] = useState<Set<string>>(new Set())
  const [groupFilter, setGroupFilter] = useState('all')
  const [gameSearch, setGameSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<QuestTypeFilter>(null)
  // Checked-but-unsaved picks. The design stages a selection and commits it on
  // Save, rather than the previous behaviour of adding on every single click.
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
    // A library of 140 games is not browsable by group and type alone; the
    // organiser usually knows the name and just wants to find it.
    const query = gameSearch.trim().toLowerCase()
    if (query) list = list.filter((game) => game.name.toLowerCase().includes(query))
    return list
  }, [available, groupFilter, groups, typeFilter, gameSearch])

  const allFilteredChecked =
    filteredAvailable.length > 0 && filteredAvailable.every((g) => ids.includes(g.id))

  /**
   * Ticking a game adds it to the stage there and then.
   *
   * It used to sit in a pending set until the picker's own Save was pressed,
   * which meant pressing the form's "Save changes" with boxes ticked threw the
   * selection away with no warning. Committing on the tick removes the failure
   * outright: there is never unsaved selection state to lose, and checking ten
   * boxes still works the same way.
   */
  function togglePending(id: string) {
    if (ids.includes(id)) {
      setStageIds(ids.filter((existing) => existing !== id))
      return
    }
    setStageIds([...ids, id], [id])
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
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={inStage.every((g) => selectedInStage.has(g.id))}
                ref={(el) => {
                  if (el)
                    el.indeterminate =
                      selectedInStage.size > 0 &&
                      !inStage.every((g) => selectedInStage.has(g.id))
                }}
                onChange={() =>
                  setSelectedInStage((current) =>
                    inStage.every((g) => current.has(g.id))
                      ? new Set()
                      : new Set(inStage.map((g) => g.id)),
                  )
                }
              />
              Select all ({inStage.length})
            </label>
            <p className="text-muted-foreground mr-auto text-xs">
              Drag to reorder — this is the order players see the challenges in.
            </p>
            {selectedInStage.size > 0 ? (
              <NeoButton
                type="button"
                variant="surface"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  setStageIds(ids.filter((id) => !selectedInStage.has(id)))
                  setSelectedInStage(new Set())
                }}
              >
                <IconTrash className="size-3.5" />
                Remove {selectedInStage.size}
              </NeoButton>
            ) : null}
          </div>
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
                <input
                  type="checkbox"
                  className="shrink-0"
                  aria-label={`Select ${g.name}`}
                  checked={selectedInStage.has(g.id)}
                  // Stops the row's drag handler claiming the click.
                  onClick={(event) => event.stopPropagation()}
                  onChange={() =>
                    setSelectedInStage((current) => {
                      const next = new Set(current)
                      if (next.has(g.id)) next.delete(g.id)
                      else next.add(g.id)
                      return next
                    })
                  }
                />
                <IconGrip className="text-muted-foreground size-4 shrink-0" />
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
                  onClick={() => {
                    setStageIds(ids.filter((id) => id !== g.id))
                    setSelectedInStage((current) => {
                      const next = new Set(current)
                      next.delete(g.id)
                      return next
                    })
                  }}
                >
                  <IconTrash className="size-3.5" />
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
          <IconPlus className="size-3.5" />
          Add More
        </NeoButton>
      ) : null}

      {pickerOpen || inStage.length === 0 ? (
        <div className="border-border/70 space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={gameSearch}
              onChange={(event) => setGameSearch(event.target.value)}
              placeholder="Search games…"
              aria-label="Search available quest games"
              className="bg-background h-8 min-w-44 flex-1 text-xs"
            />
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
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
              onClick={() => {
                const filteredIds = filteredAvailable.map((g) => g.id)
                if (allFilteredChecked) {
                  setStageIds(ids.filter((id) => !filteredIds.includes(id)))
                  return
                }
                const toAdd = filteredIds.filter((id) => !ids.includes(id))
                setStageIds([...ids, ...toAdd], toAdd)
              }}
            >
              {allFilteredChecked ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUEST_TYPE_FILTERS.map(({ label, type }) => (
              <button
                key={label}
                type="button"
                onClick={() => setTypeFilter(type)}
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
              <ul className="border-border/70 divide-y rounded-md border">
                {filteredAvailable.map((g) => (
                  <li key={g.id}>
                    <label className="hover:bg-muted/40 flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={ids.includes(g.id)}
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
                  onClick={() => setPickerOpen(false)}
                >
                  Done
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
