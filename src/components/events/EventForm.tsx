import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconGrip,
  IconPlus,
  IconTrash,
} from '@/components/icons'
import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NeoButton, SegmentedPill } from '@/components/neo-minimal'
import { AssetField } from '@/components/games/AssetField'
import { BrandColourPicker } from '@/components/admin/BrandColourPicker'
import { EventPreviewModal } from '@/components/events/EventPreviewModal'
import { IconEye } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { EventStorePanel } from '@/components/events/EventStorePanel'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NumberField } from '@/components/ui/number-field'
import { Label } from '@/components/ui/label'
import type { GameGroupWithItems } from '@/hooks/use-game-groups'
import type { GameRow } from '@/hooks/use-games'
import { useOrgFeatureFlags } from '@/hooks/use-feature-flags'
import type { OrganizationRow } from '@/hooks/use-organization-settings'
import { APP_LANGUAGES } from '@/lib/i18n'
import { normaliseLogoImage } from '@/lib/logo-image'
import { uploadAsset } from '@/lib/storage'
import {
  addStage,
  moveStage,
  isBookendStage,
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

/** The design caps event names so they fit the card and live display header. */
export const EVENT_NAME_MAX_LENGTH = 40

/** Stage type values are stored on the event; only their labels are translated. */
const STAGE_TYPE_VALUES: EventStage['type'][] = ['open', 'quiz', 'bingo', 'break']

/**
 * Icon buttons that sit on a stage's charcoal header strip. The ghost variant
 * hovers with the light theme's muted grey, which vanishes on charcoal, so
 * these swap to ivory ink and a translucent white hover in both themes.
 * #faf7f3 is the ivory the design system already puts on charcoal buttons.
 */
const STAGE_HEADER_ICON_BUTTON =
  'text-[#faf7f3]/80 hover:bg-white/15 hover:text-[#faf7f3] dark:hover:bg-white/15'

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
  const { t } = useTranslation('admin')
  // P6.1 feature flags: gate which stage types can be PICKED and whether the
  // event store section is offered. A stage that already carries a now
  // disallowed type keeps rendering and stays editable; only new choices are
  // limited. Absent flags mean everything is allowed.
  const { flags } = useOrgFeatureFlags()
  const allowedStagePillValues = STAGE_TYPE_VALUES.filter((value) =>
    flags.allowedStageTypes.includes(value as 'open' | 'quiz' | 'bingo' | 'break'),
  )
  const someStageTypesHidden = allowedStagePillValues.length < STAGE_TYPE_VALUES.length
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

  // Each colour says what it actually paints, because "secondary" means
  // nothing until you know it is the base behind the blobs.
  const brandFields = [
    { label: t('events.form.brandPrimary'), help: t('events.form.brandPrimaryHelp') },
    { label: t('events.form.brandSecondary'), help: t('events.form.brandSecondaryHelp') },
    { label: t('events.form.brandAccent'), help: t('events.form.brandAccentHelp') },
  ]

  const stageTypeLabels: Record<EventStage['type'], string> = {
    open: t('events.form.stageType.quest'),
    quiz: t('events.form.stageType.quiz'),
    bingo: t('events.form.stageType.bingo'),
    break: t('events.form.stageType.break'),
    welcome: t('events.form.stageType.welcome'),
    end: t('events.form.stageType.end'),
  }

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

  const hasEndStage = stages.some((stage) => stage.type === 'end')

  // The in-list Add stage button (P1.2): gold, rendered inside the running
  // order directly under the last movable stage and above the pinned End
  // stage, so a new stage visibly lands where the button sits.
  const addStageButton = (
    <NeoButton
      type="button"
      variant="accent"
      className="w-full justify-center"
      onClick={() => onChange((prev) => ({ ...prev, stages: addStage(prev.stages) }))}
    >
      <IconPlus className="size-4" />
      {t('events.form.addStage')}
    </NeoButton>
  )

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
            <h2 className="text-foreground text-base font-bold">{t('events.form.primary')}</h2>
            <p className="text-muted-foreground mt-1 text-xs">{t('events.form.primaryHelp')}</p>
          </div>
          <div className="space-y-2">
            <Label>
              {t('events.form.eventName')}{' '}
              <span className="text-muted-foreground font-normal">
                {t('events.form.maxCharacters', { count: EVENT_NAME_MAX_LENGTH })}
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
            <Label>{t('events.form.eventDateTime')}</Label>
            <Input
              type="datetime-local"
              value={eventDate}
              onChange={(e) => set({ eventDate: e.target.value })}
              className="bg-background max-w-sm"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('events.form.location')}</Label>
            <Input
              value={values.location}
              onChange={(e) => set({ location: e.target.value })}
              placeholder={t('events.form.locationPlaceholder')}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('events.form.eventLanguage')}</Label>
            <select
              value={values.language}
              onChange={(e) => set({ language: e.target.value as EventFormValues['language'] })}
              className="border-input bg-background w-full max-w-sm rounded-lg border px-3 py-2 text-sm"
            >
              {APP_LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              {t('events.form.eventLanguageHelp')}
            </p>
          </div>
          <div className="space-y-2">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={values.multilingual}
                onChange={(e) =>
                  set({
                    multilingual: e.target.checked,
                    // Seed with the event language so turning this on always
                    // leaves at least one choice on the picker.
                    availableLanguages: e.target.checked
                      ? values.availableLanguages.length
                        ? values.availableLanguages
                        : [values.language]
                      : values.availableLanguages,
                  })
                }
                className="border-input mt-0.5 size-4 rounded"
              />
              <span className="text-sm font-medium">
                {t('events.form.multilingual')}
              </span>
            </label>
            <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
              {t('events.form.multilingualHelp')}
            </p>
            {values.multilingual ? (
              <div className="border-border/80 mt-1 space-y-2 rounded-lg border p-3">
                <p className="text-xs font-semibold">
                  {t('events.form.availableLanguages')}
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {APP_LANGUAGES.map(({ code, label }) => {
                    const checked = values.availableLanguages.includes(code)
                    // The event language is always offered: it is what a team
                    // that never picks, or picks nothing valid, falls back to.
                    const locked = code === values.language
                    return (
                      <label key={code} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked || locked}
                          disabled={locked}
                          onChange={(e) =>
                            set({
                              availableLanguages: e.target.checked
                                ? [...values.availableLanguages, code]
                                : values.availableLanguages.filter((c) => c !== code),
                            })
                          }
                          className="border-input size-4 rounded disabled:opacity-60"
                        />
                        <span>{label}</span>
                        {locked ? (
                          <span className="text-muted-foreground text-[11px]">
                            {t('events.form.availableLanguagesEventDefault')}
                          </span>
                        ) : null}
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <PillPair
              label={t('events.form.displayLabel')}
              leftLabel={t('events.form.rankList')}
              rightLabel={t('events.form.orbit')}
              rightSelected={values.displayLayout === 'orbit_view'}
              onChange={(rightSelected) => set({ displayLayout: rightSelected ? 'orbit_view' : 'rank_list' })}
            />
            <PillPair
              label={t('events.form.uiColour')}
              leftLabel={t('events.form.white')}
              rightLabel={t('events.form.black')}
              rightSelected={values.displayTextColor === 'black'}
              onChange={(rightSelected) => set({ displayTextColor: rightSelected ? 'black' : 'white' })}
            />
            <PillPair
              label={t('events.form.purchaseItems')}
              leftLabel={t('events.form.off')}
              rightLabel={t('events.form.on')}
              rightSelected={inventoryEnabled}
              onChange={(rightSelected) => set({ inventoryEnabled: rightSelected })}
            />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t('events.form.displayHelp')}
          </p>
        </Card>

        <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm sm:p-6">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-2">
            <div>
              <h2 className="text-foreground text-base font-bold">{t('events.form.branding')}</h2>
              <p className="text-muted-foreground mt-1 text-xs">{t('events.form.brandingHelp')}</p>
            </div>
            <PillPair
              label={t('events.form.customBranding')}
              leftLabel={t('events.form.off')}
              rightLabel={t('events.form.on')}
              rightSelected={brandingEnabled}
              onChange={(rightSelected) => set({ brandingEnabled: rightSelected })}
            />
          </div>
          {brandingEnabled ? (
            <>
              {/* Upload only, with the logo shown beside the button: a logo is
                  a file the organiser has, never a URL they type. */}
              <AssetField
                label={t('events.form.eventLogo')}
                inlinePreview
                preview={logoUrl}
                onFile={async (file) => {
                  if (!file) return
                  // P1.3: store every logo at the standard size so live
                  // screens render them consistently.
                  const upload = await normaliseLogoImage(file)
                  const url = await uploadAsset(
                    'organization-logos',
                    `${organizationId}/events/${brandingStorageKey}/${crypto.randomUUID()}`,
                    upload,
                    { mediaKind: 'logo' },
                  )
                  set({ logoUrl: url })
                }}
              />
              <div className="space-y-3">
                {brandColors.map((c, i) => (
                  <div key={`event-brand-${i}`} className="flex items-center gap-3">
                    <div className="w-20 shrink-0">
                      <BrandColourPicker
                        id={`event-brand-${i}`}
                        label={brandFields[i].label}
                        value={c}
                        onChange={(hex) => {
                          const next = [...brandColors] as [string, string, string]
                          next[i] = hex
                          set({ brandColors: next })
                        }}
                      />
                    </div>
                    <p className="text-muted-foreground min-w-0 flex-1 text-xs leading-relaxed">
                      {brandFields[i].help}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : orgDefaults ? (
            <p className="text-muted-foreground text-sm">
              {t('events.form.usingOrgBranding')}
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
            {t('events.form.previewEvent')}
          </NeoButton>
        </Card>
      </div>

      {/* Teams and Store side by side: both are short lists describing what
          the event physically consists of, and neither needs full width.
          items-stretch keeps them the same height as either one grows. */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
      <Card className="border-border/80 flex flex-col space-y-4 bg-card p-5 shadow-sm sm:p-6">
        <div className="border-border flex flex-wrap items-end gap-4 border-b pb-3">
          <div className="mr-auto">
            <h3 className="text-foreground text-base font-bold">{t('events.form.teams')}</h3>
            <p className="text-muted-foreground mt-1 text-xs">{t('events.form.teamsHelp')}</p>
          </div>
          <div className="space-y-2">
            <Label>
              {t('events.form.numberOfTeams')}{' '}
              <span className="text-muted-foreground font-normal">
                {t('events.form.minimumTeams', { count: minTeamCount })}
              </span>
            </Label>
            <div className="flex items-center gap-1.5">
              <Button type="button" size="icon-sm" variant="outline" disabled={teamCount <= minTeamCount} onClick={() => onTeamCountChange(teamCount - 1)}>−</Button>
              <NumberField min={minTeamCount} max={maxTeamCount} value={teamCount} onChange={onTeamCountChange} className="bg-background h-8 w-16 text-center tabular-nums" />
              <Button type="button" size="icon-sm" variant="outline" disabled={teamCount >= maxTeamCount} onClick={() => onTeamCountChange(teamCount + 1)}>+</Button>
            </div>
          </div>
          {maxTeamCount <= 2 ? (
            <p className="text-muted-foreground text-xs">
              {t('events.form.demoTeamLimit', { count: maxTeamCount })}
            </p>
          ) : null}
        </div>
        {maxTeamCount > 2 ? (
          teamCharge.count > 0 ? (
            <div className="border-primary/40 bg-primary/5 rounded-lg border px-4 py-3 text-sm">
              <p className="text-foreground font-medium">
                {t('events.form.additionalTeamCharge', {
                  amount: formatEur(teamCharge.amountEur),
                })}
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {t('events.form.additionalTeamNote', {
                  count: teamCharge.count,
                  price: formatEur(ADDITIONAL_TEAM_PRICE_EUR),
                })}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              {t('events.form.teamsIncludedNote', {
                price: formatEur(ADDITIONAL_TEAM_PRICE_EUR),
              })}
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
                aria-label={t('events.form.teamColourAria', {
                  team: team.name || t('events.teamNumber', { index: index + 1 }),
                })}
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
                placeholder={t('events.teamNumber', { index: index + 1 })}
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
                  title={t('events.form.removeTeam')}
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

      {/* P6.1: store_enabled false hides ENABLING the store. An event that
          already carries store items (built before the flag flipped) keeps its
          panel so the organiser can still manage or empty it. */}
      {flags.storeEnabled || values.store.length > 0 ? (
        <Card className="border-border/80 flex flex-col space-y-4 bg-card p-5 shadow-sm sm:p-6">
          <EventStorePanel
            organizationId={organizationId}
            store={values.store}
            onChange={(store) => onChange((prev) => ({ ...prev, store }))}
          />
        </Card>
      ) : (
        <Card className="border-border/80 flex flex-col space-y-2 bg-card p-5 shadow-sm sm:p-6">
          <h3 className="text-foreground text-base font-bold">
            {t('events.store.title')}
          </h3>
          <p className="text-muted-foreground text-xs">
            {t('featureGating.notIncluded')}
          </p>
        </Card>
      )}
      </div>

      <Card className="border-border/80 space-y-4 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-base font-bold">{t('events.form.stages')}</h3>
            <p className="text-muted-foreground mt-1 text-xs">{t('events.form.stagesHelp')}</p>
          </div>
          {/* Gold: adding a stage is THE next action on this card (P1.2). */}
          <NeoButton
            type="button"
            variant="accent"
            size="sm"
            onClick={() => onChange((prev) => ({ ...prev, stages: addStage(prev.stages) }))}
          >
            <IconPlus className="size-4" />
            {t('events.form.addStage')}
          </NeoButton>
        </div>
        {stages.map((stage, stageIndex) => {
          const bookend = isBookendStage(stage)
          const hasWelcome = stages[0]?.type === 'welcome'
          const hasEnd = stages[stages.length - 1]?.type === 'end'
          const firstMovable = hasWelcome ? 1 : 0
          const lastMovable = hasEnd ? stages.length - 2 : stages.length - 1
          const middleCount = stages.filter((s) => !isBookendStage(s)).length
          const stageLabel =
            stage.type === 'welcome'
              ? t('events.form.welcomeStageLabel')
              : stage.type === 'end'
                ? t('events.form.endStageLabel')
                : t('events.form.stageNumber', {
                    index:
                      stages.slice(0, stageIndex).filter((s) => !isBookendStage(s)).length + 1,
                  })
          // Used when the organiser has not named the stage yet.
          const stageFallbackName =
            stage.name || t('events.form.stageFallback', { index: stageIndex + 1 })
          return (
          <Fragment key={stage.id}>
          {/* The add button sits inside the running order, just above the
              pinned End stage: a new stage lands exactly where the button is. */}
          {stage.type === 'end' ? addStageButton : null}
          <Card className="border-border/80 bg-background gap-0 overflow-hidden rounded-md p-0 shadow-none">
            {/* Charcoal header strip: each stage reads as its own block. The
                pinned bookends wear a muted version of the same strip. */}
            <div
              className={cn(
                'flex flex-wrap items-center gap-3 px-3 py-2',
                bookend ? 'bg-nm-charcoal/75' : 'bg-nm-charcoal',
              )}
            >
              {/* A long event is a long page. Collapsing a finished stage keeps
                  the one being edited on screen. */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={STAGE_HEADER_ICON_BUTTON}
                aria-label={
                  collapsedStages[stage.id]
                    ? t('events.form.expandStage', { stage: stageFallbackName })
                    : t('events.form.collapseStage', { stage: stageFallbackName })
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
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#faf7f3]/60">{stageLabel}</span>
              {bookend ? (
                <span className="min-w-40 flex-1 text-sm font-semibold text-[#faf7f3]">{stage.name}</span>
              ) : (
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
              )}
              {/* Running order changes constantly while planning, and
                  rebuilding a stage just to move it was the only way. Welcome
                  and End are pinned, so they show no move/delete controls. */}
              {bookend ? null : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={STAGE_HEADER_ICON_BUTTON}
                    aria-label={t('events.form.moveStageEarlier', { stage: stageFallbackName })}
                    disabled={stageIndex <= firstMovable}
                    onClick={() => onChange((prev) => ({ ...prev, stages: moveStage(prev.stages, stageIndex, -1) }))}
                  >
                    <IconArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={STAGE_HEADER_ICON_BUTTON}
                    aria-label={t('events.form.moveStageLater', { stage: stageFallbackName })}
                    disabled={stageIndex >= lastMovable}
                    onClick={() => onChange((prev) => ({ ...prev, stages: moveStage(prev.stages, stageIndex, 1) }))}
                  >
                    <IconArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={STAGE_HEADER_ICON_BUTTON}
                    aria-label={t('events.form.deleteStage', { stage: stageFallbackName })}
                    disabled={middleCount <= 1}
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        stages: prev.stages.filter((x) => x.id !== stage.id),
                      }))
                    }
                  >
                    <IconTrash className="size-4" />
                  </Button>
                </>
              )}
            </div>
            {collapsedStages[stage.id] ? null : (
            <div className="space-y-3 p-4">
            {bookend ? (
              <label className="space-y-1.5 text-xs font-medium">
                <span>
                  {stage.type === 'welcome'
                    ? t('events.form.welcomeMessage')
                    : t('events.form.endMessage')}
                </span>
                <textarea
                  placeholder={
                    stage.type === 'welcome'
                      ? t('events.form.welcomeMessage')
                      : t('events.form.endMessage')
                  }
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
                <span className="text-muted-foreground block text-[11px] font-normal normal-case">
                  {stage.type === 'welcome'
                    ? t('events.form.welcomeMessageHelp')
                    : t('events.form.endMessageHelp')}
                </span>
              </label>
            ) : (
            <>
            <SegmentedPill
              aria-label={t('events.form.stageTypeAria')}
              options={STAGE_TYPE_VALUES.filter(
                (value) =>
                  allowedStagePillValues.includes(value) || value === stage.type,
              ).map((value) => ({
                value,
                label: stageTypeLabels[value],
              }))}
              value={stage.type}
              onChange={(next) => setStageType(stage.id, next)}
            />
            {someStageTypesHidden ? (
              <p className="text-muted-foreground text-[11px]">
                {t('featureGating.someHidden')}
              </p>
            ) : null}
            {stage.type === 'break' ? (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-end">
                <label className="space-y-1.5 text-xs font-medium">
                  <span>{t('events.form.breakMessage')}</span>
                  <textarea
                  placeholder={t('events.form.breakMessage')}
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
                    {t('events.form.duration')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <NumberField
                      min={0}
                      aria-label={t('events.form.breakMinutes')}
                      value={stage.durationMinutes ?? 0}
                      onChange={(n) =>
                        onChange((prev) => ({
                          ...prev,
                          stages: prev.stages.map((x) =>
                            x.id === stage.id ? { ...x, durationMinutes: n } : x,
                          ),
                        }))
                      }
                      className="bg-background w-16 text-center tabular-nums"
                    />
                    <span className="text-muted-foreground">{t('events.form.min')}</span>
                    <NumberField
                      min={0}
                      max={59}
                      aria-label={t('events.form.breakSeconds')}
                      value={stage.durationSeconds ?? 0}
                      onChange={(n) =>
                        onChange((prev) => ({
                          ...prev,
                          stages: prev.stages.map((x) =>
                            x.id === stage.id ? { ...x, durationSeconds: n } : x,
                          ),
                        }))
                      }
                      className="bg-background w-16 text-center tabular-nums"
                    />
                    <span className="text-muted-foreground">{t('events.form.sec')}</span>
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
                <option value="">{t('events.form.selectGame')}</option>
                {compatibleGames(stage.type).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
            {stage.type === 'quiz' || stage.type === 'bingo' ? (
              /* Which look the room wears during this stage: the event's own
                 branding, or the background designed inside the game (CF3-16). */
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium">{t('events.form.branding')}</span>
                <SegmentedPill
                  size="sm"
                  className="w-64"
                  aria-label={t('events.form.brandingForStage', {
                    stage: stage.name || t('events.form.stageWord'),
                  })}
                  options={[
                    { value: 'event', label: t('events.form.eventBranding') },
                    { value: 'game', label: t('events.form.gameBranding') },
                  ]}
                  value={stage.branding ?? 'event'}
                  onChange={(next) =>
                    onChange((prev) => ({
                      ...prev,
                      stages: prev.stages.map((x) =>
                        x.id === stage.id
                          ? { ...x, branding: next as 'event' | 'game' }
                          : x,
                      ),
                    }))
                  }
                />
              </div>
            ) : null}
            </>
            )}
            </div>
            )}
          </Card>
          </Fragment>
          )
        })}
        {/* Legacy events without a pinned End stage keep the in-list button at
            the bottom, still directly under the last movable stage. */}
        {hasEndStage ? null : addStageButton}
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

/** Filter values stay raw (they match game types); labels are translated. */
const QUEST_TYPE_FILTERS: QuestTypeFilter[] = [null, 'photo', 'video', 'puzzle', 'text']

type QuestStageGamesProps = {
  stage: EventStage
  groups: GameGroupWithItems[]
  /** Photo/video/text/puzzle games already added to the event. */
  compatible: GameRow[]
  onChange: EventFormProps['onChange']
}

/** Quest stage games: ordered draggable list (= players' display order) + quick add. */
function QuestStageGames({ stage, groups, compatible, onChange }: QuestStageGamesProps) {
  const { t } = useTranslation('admin')
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

  // Game type values come from the database; only the badge label changes.
  const gameTypeLabels: Record<string, string> = {
    photo: t('events.form.gameType.photo'),
    video: t('events.form.gameType.video'),
    text: t('events.form.gameType.text'),
    puzzle: t('events.form.gameType.puzzle'),
    quiz: t('events.form.gameType.quiz'),
    music_bingo: t('events.form.gameType.bingo'),
  }

  const questFilterLabels: Record<string, string> = {
    all: t('events.form.questFilter.all'),
    photo: t('events.form.questFilter.photo'),
    video: t('events.form.questFilter.video'),
    puzzle: t('events.form.questFilter.puzzle'),
    text: t('events.form.questFilter.text'),
  }

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
              {t('events.form.selectAllCount', { count: inStage.length })}
            </label>
            <p className="text-muted-foreground mr-auto text-xs">
              {t('events.form.dragToReorder')}
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
                {t('events.form.removeCount', { count: selectedInStage.size })}
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
                  aria-label={t('events.form.selectGameAria', { name: g.name })}
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
                <span className="text-muted-foreground shrink-0 text-xs">
                  {gameTypeLabels[g.type] ?? g.type}
                </span>
                <button
                  type="button"
                  title={t('events.form.removeFromStage')}
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
        <p className="text-muted-foreground text-xs">{t('events.form.noStageGames')}</p>
      )}

      {inStage.length > 0 && !pickerOpen && available.length > 0 ? (
        <NeoButton type="button" variant="surface" size="sm" onClick={() => setPickerOpen(true)}>
          <IconPlus className="size-3.5" />
          {t('events.form.addMore')}
        </NeoButton>
      ) : null}

      {pickerOpen || inStage.length === 0 ? (
        <div className="border-border/70 space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={gameSearch}
              onChange={(event) => setGameSearch(event.target.value)}
              placeholder={t('events.form.searchGames')}
              aria-label={t('events.form.searchGamesAria')}
              className="bg-background h-8 min-w-44 flex-1 text-xs"
            />
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="border-input bg-background h-8 min-w-40 rounded-md border px-2 text-xs font-semibold"
              aria-label={t('events.form.filterByGroupAria')}
            >
              <option value="all">{t('events.form.allGroups')}</option>
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
              {allFilteredChecked ? t('events.form.deselectAll') : t('events.form.selectAll')}
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUEST_TYPE_FILTERS.map((type) => (
              <button
                key={type ?? 'all'}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  typeFilter === type
                    ? 'bg-nm-yellow text-nm-charcoal'
                    : 'border-border text-muted-foreground hover:bg-muted/50 border',
                )}
              >
                {questFilterLabels[type ?? 'all']}
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
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {gameTypeLabels[g.type] ?? g.type}
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
                  {t('events.done')}
                </NeoButton>
              </div>
            </>
          ) : available.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              {t('events.form.noGamesMatchFilters')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
