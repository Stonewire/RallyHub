import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'

import { useOptionalTenant } from '@/contexts/tenant-context'
import { orgPath } from '@/lib/org-path'
import { NeoButton } from '@/components/neo-minimal'
import {
  NoOrganizationMessage,
  QueryError,
  QueryLoading,
} from '@/components/admin/QueryState'
import { EventActivityLog } from '@/components/admin/EventActivityLog'
import { EventTasksPanel } from '@/components/events/EventTasksPanel'
import { DangerZone } from '@/components/admin/DangerZone'
import { EventForm } from '@/components/events/EventForm'
import { EventLinksPanel, EventQrDownloadButton } from '@/components/events/EventLinksPanel'
import { EventResetConfirmDialog } from '@/components/events/EventResetConfirmDialog'
import { RecurringRestartConfirmDialog } from '@/components/events/RecurringRestartConfirmDialog'
import { EventStatusMenu } from '@/components/events/EventStatusMenu'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { Card } from '@/components/ui/card'
import { useNotification } from '@/contexts/notification-context'
import {
  useDuplicateEvent,
  useDeleteEvent,
  useEvent,
  useEventGameIds,
  useResetEventData,
  useRestartRecurringEvent,
  useUpdateEvent,
  useUpdateEventStatus,
} from '@/hooks/use-events'
import { useEventActivationFlow } from '@/hooks/use-event-activation-flow'
import { useGameGroups } from '@/hooks/use-game-groups'
import { useGames } from '@/hooks/use-games'
import { useOrganization } from '@/hooks/use-organization-settings'
import { useOrganizationId } from '@/hooks/use-organization-id'
import {
  availableLanguagesForSave,
  collectEventGameIds,
  emptyEventForm,
  eventToFormValues,
  type EventFormValues,
} from '@/lib/event-form-utils'
import { formatSupabaseError, logSupabaseFailure } from '@/lib/supabase-errors'
import { publishLiveBundleReload } from '@/lib/live-broadcast'
import { downloadEventPackage, formatMb } from '@/lib/event-export'
import { clampTeamCount, MAX_TEAM_COUNT } from '@/lib/event-demo'
import { isEventActivated, canResetEventData } from '@/lib/event-lifecycle'
import { brandColorsForEvent, brandColorsFromOrg, logoForEvent } from '@/lib/live-event'
import type { EventStatus } from '@/types/database'

export function AdminEventEditPage() {
  const { t } = useTranslation('admin')
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const clientSlug = useOptionalTenant()?.tenantOrg?.subdomain ?? null
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  const gamesQuery = useGames(organizationId)
  const groupsQuery = useGameGroups(organizationId)
  const eventQuery = useEvent(eventId)
  const gameIdsQuery = useEventGameIds(eventId)
  const updateEvent = useUpdateEvent(organizationId)
  const updateStatus = useUpdateEventStatus(organizationId)
  const duplicateEvent = useDuplicateEvent(organizationId)
  const deleteEvent = useDeleteEvent(organizationId)
  const resetEventDataMutation = useResetEventData(organizationId)
  const restartRecurringMutation = useRestartRecurringEvent(organizationId)
  const { notify } = useNotification()
  const activation = useEventActivationFlow({
    billingPlan: orgQuery.data?.billing_plan,
    organizationId,
    educationalStatus: orgQuery.data?.educational_status,
    customPerEventPriceEur: orgQuery.data?.custom_per_event_price_eur,
    onValidationError: notify,
  })

  const [values, setValues] = useState<EventFormValues>(emptyEventForm)
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  // Large events take minutes to export; a silent disabled button reads as
  // broken (562 MB client event, 31 Jul 2026), so progress is shown throughout.
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [restartDialogOpen, setRestartDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'settings' | 'tasks' | 'log'>('settings')

  // Baseline snapshot of the form as loaded, for unsaved-change detection (#15).
  const baselineRef = useRef<string>('')
  const bypassBlockRef = useRef(false)

  useEffect(() => {
    if (eventQuery.data && gameIdsQuery.data !== undefined && !hydrated) {
      const initial = eventToFormValues(eventQuery.data, gameIdsQuery.data)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates the local editable form from fetched data, once
      setValues(initial)
      baselineRef.current = JSON.stringify(initial)
      setHydrated(true)
    }
  }, [eventQuery.data, gameIdsQuery.data, hydrated])

   
  const dirty = hydrated && JSON.stringify(values) !== baselineRef.current

  // Leaving with unsaved changes SAVES them (Rumen, 9 Aug): the device back
  // button/gesture means "save and go back", not "ask me questions".
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !bypassBlockRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  )
  const autoSavingRef = useRef(false)
  useEffect(() => {
    if (blocker.state !== 'blocked' || autoSavingRef.current) return
    autoSavingRef.current = true
    void (async () => {
      const ok = await handleSave(() => blocker.proceed?.())
      if (!ok) blocker.reset?.()
      autoSavingRef.current = false
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per blocked transition; handleSave identity churns every render
  }, [blocker.state])

  async function handleSave(onSaved?: () => void): Promise<boolean> {
    if (!organizationId || !eventId || !values.name.trim()) {
      setError(t('events.errors.nameRequired'))
      return false
    }
    const gameStages = values.stages.filter(
      (s) => s.type === 'open' || s.type === 'quiz' || s.type === 'bingo',
    )
    if (gameStages.length === 0) {
      setError(t('events.errors.addGameStage'))
      return false
    }

    setSaving(true)
    setError(null)
    try {
      const org = orgQuery.data
      await updateEvent.mutateAsync({
        eventId,
        event: {
          name: values.name.trim(),
          location: values.location.trim() || null,
          event_date: values.eventDate
            ? new Date(values.eventDate).toISOString()
            : null,
          language: values.language,
          multilingual: values.multilingual,
          available_languages: availableLanguagesForSave(values),
          team_count: clampTeamCount(values.teamCount),
          open_joining: values.openJoining,
          branding_enabled: values.brandingEnabled,
          inventory_enabled: values.inventoryEnabled,
          recurring: values.recurring,
          logo_url: values.brandingEnabled
            ? values.logoUrl
            : org?.logo_url ?? null,
          brand_colors: values.brandingEnabled
            ? values.brandColors
            : brandColorsFromOrg(org),
          teams_config: values.teams,
          stages_config: values.stages,
          store_config: values.store,
          display_layout: values.displayLayout,
          display_text_color: values.displayTextColor,
        },
        gameIds: collectEventGameIds(values.selectedGameIds, values.stages),
      })
      // Push a live reload so any player/display already on this event picks up
      // new/removed games without a manual refresh.
      void publishLiveBundleReload(eventId)
      baselineRef.current = JSON.stringify(values)
      bypassBlockRef.current = true
      if (onSaved) onSaved()
      else navigate(orgPath(clientSlug, '/admin/events'), { replace: true })
      return true
    } catch (err) {
      const message = formatSupabaseError(err)
      logSupabaseFailure('AdminEventEditPage.handleSave', err)
      setError(message)
      notify(message)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleDuplicate() {
    if (!eventQuery.data || !gameIdsQuery.data) return
    setError(null)
    try {
      const copy = await duplicateEvent.mutateAsync({
        source: eventQuery.data,
        gameIds: gameIdsQuery.data,
      })
      navigate(orgPath(clientSlug, `/admin/events/${copy.id}`), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('events.errors.duplicateFailed'))
    }
  }

  if (!organizationId) {
    return (
      <AdminPageShell
        title={t('events.edit.title')}
        subtitle={t('events.edit.subtitleShort')}
        backTo={orgPath(clientSlug, '/admin/events')}
        backLabel={t('events.backToEvents')}
      >
        <NoOrganizationMessage />
      </AdminPageShell>
    )
  }

  const loading =
    eventQuery.isLoading || gameIdsQuery.isLoading || !hydrated

  const eventStatus = (eventQuery.data?.status ?? 'draft') as EventStatus
  const isArchived = eventStatus === 'archived'
  const activated = eventQuery.data ? isEventActivated(eventQuery.data) : false
  const resetAllowed = canResetEventData(eventStatus)
  // P6.4: a recurring event that has finished a run (activated, not currently
  // live) can be re-armed for its next one. The RPC enforces the same rule.
  const canRestartRecurring =
    Boolean(eventQuery.data?.recurring) && activated && eventStatus !== 'active'

  async function handleResetEventData() {
    if (!eventId) return
    try {
      await resetEventDataMutation.mutateAsync(eventId)
      setResetDialogOpen(false)
      notify(t('events.edit.resetSuccess'))
    } catch (err) {
      notify(err instanceof Error ? err.message : t('events.edit.resetError'))
    }
  }

  async function handleRestartRecurring() {
    if (!eventId) return
    try {
      await restartRecurringMutation.mutateAsync(eventId)
      setRestartDialogOpen(false)
      notify(t('events.restart.success'))
    } catch (err) {
      setRestartDialogOpen(false)
      const message = err instanceof Error ? err.message : ''
      notify(
        message.includes('UNPAID_INVOICE')
          ? t('events.restart.unpaidError')
          : message || t('events.restart.error'),
      )
    }
  }

  async function handleDeleteEvent() {
    if (!eventId) return
    try {
      await deleteEvent.mutateAsync(eventId)
      notify(t('events.edit.deleteSuccess'))
      navigate(orgPath(clientSlug, '/admin/events'), { replace: true })
    } catch (err) {
      notify(err instanceof Error ? err.message : t('events.edit.deleteError'))
    }
  }

  return (
    <AdminPageShell
      title={isArchived ? t('events.edit.viewTitle') : t('events.edit.title')}
      subtitle={
        isArchived
          ? t('events.edit.subtitleArchived')
          : t('events.edit.subtitle')
      }
      backTo={orgPath(clientSlug, '/admin/events')}
      backLabel={t('events.backToEvents')}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {!isArchived && (
            <EventStatusMenu
              status={eventStatus}
              activatedAt={eventQuery.data?.activated_at}
              size="default"
              disabled={
                updateStatus.isPending || activation.confirmingActivation || loading
              }
              onSelect={(status) => {
                if (!eventId || !eventQuery.data) return
                activation.requestStatusChange(
                  eventId,
                  eventStatus,
                  status,
                  eventQuery.data.name,
                  eventQuery.data.team_count,
                  eventQuery.data.activated_at,
                  () => updateStatus.mutateAsync({ eventId, status }).then(() => undefined),
                  eventQuery.data.open_joining,
                  eventQuery.data.recurring,
                )
              }}
            />
          )}
          <NeoButton
            type="button"
            variant="surface"
            disabled={duplicateEvent.isPending || loading}
            onClick={() => void handleDuplicate()}
          >
            {duplicateEvent.isPending
              ? t('events.duplicating')
              : t('events.edit.duplicateEvent')}
          </NeoButton>
          {!isArchived && (
            <NeoButton
              type="button"
              variant="primary"
              disabled={saving || loading}
              onClick={() => void handleSave()}
            >
              {saving ? t('events.saving') : t('events.saveChanges')}
            </NeoButton>
          )}
        </div>
      }
    >
      {eventQuery.isError ? (
        <QueryError message={eventQuery.error.message} />
      ) : loading ? (
        <QueryLoading rows={6} />
      ) : (
        <>
          <div className="mb-6 flex gap-1 border-b border-border/60">
            {([
              ['settings', t('events.tabs.settings')],
              ['tasks', t('events.tabs.tasks')],
              ['log', t('events.tabs.log')],
            ] as const).map(([tab, tabLabel]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tabLabel}
              </button>
            ))}
          </div>

          {activeTab === 'settings' && (
            <>
              {canRestartRecurring ? (
                <Card className="border-primary/40 bg-primary/5 mb-6 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0 max-w-xl">
                    <p className="text-foreground font-medium">
                      {t('events.restart.cardTitle')}
                    </p>
                    <p className="text-muted-foreground mt-1">
                      {t('events.restart.cardHint')}
                    </p>
                  </div>
                  <NeoButton
                    type="button"
                    variant="primary"
                    disabled={restartRecurringMutation.isPending || loading}
                    onClick={() => setRestartDialogOpen(true)}
                  >
                    {t('events.restart.action')}
                  </NeoButton>
                </Card>
              ) : null}

              {isArchived ? (
                <Card className="border-border/80 mb-6 bg-muted/30 p-4 text-sm">
                  <p className="text-foreground font-medium">{t('events.edit.archivedReadOnly')}</p>
                  <p className="text-muted-foreground mt-1">
                    {t('events.edit.archivedReadOnlyHint')}
                  </p>
                </Card>
              ) : activated ? (
                <Card className="border-border/80 mb-6 bg-muted/30 p-4 text-sm">
                  <p className="text-foreground font-medium">{t('events.edit.activatedTitle')}</p>
                  <p className="text-muted-foreground mt-1">
                    {t('events.edit.activatedHint')}
                  </p>
                </Card>
              ) : null}

              {error ? (
                <p className="text-destructive mb-4 text-sm" role="alert">
                  {error}
                </p>
              ) : null}

              <fieldset disabled={isArchived} className="contents">
                <EventForm
                  organizationId={organizationId}
                  storageKey={eventId}
                  values={values}
                  onChange={setValues}
                  games={gamesQuery.data ?? []}
                  groups={groupsQuery.data ?? []}
                  orgDefaults={orgQuery.data ?? null}
                  maxTeamCount={MAX_TEAM_COUNT}
                />
              </fieldset>

              {eventId && eventQuery.data ? (
                <Card className="border-border/80 mt-8 space-y-4 bg-card p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-foreground text-lg font-semibold">{t('events.links.title')}</h2>
                      <p className="text-muted-foreground text-sm">
                        {t('events.links.subtitle')}
                      </p>
                    </div>
                    {/* Top right and yellow: this is the one thing an organiser
                        takes off this card and into the room. */}
                    <EventQrDownloadButton
                      eventId={eventId}
                      eventName={eventQuery.data.name}
                      eventSlug={eventQuery.data.slug}
                      organization={
                        orgQuery.data
                          ? {
                              subdomain: orgQuery.data.subdomain,
                              custom_domain: orgQuery.data.custom_domain,
                            }
                          : null
                      }
                      branding={{ eventName: eventQuery.data.name }}
                    />
                  </div>
                  <EventLinksPanel
                    hideDownloadAll
                    eventId={eventId}
                    eventName={eventQuery.data.name}
                    eventSlug={eventQuery.data.slug}
                    organization={
                      orgQuery.data
                        ? {
                            subdomain: orgQuery.data.subdomain,
                            custom_domain: orgQuery.data.custom_domain,
                          }
                        : null
                    }
                    branding={{
                      eventName: eventQuery.data.name,
                      logoUrl: logoForEvent(eventQuery.data, orgQuery.data ?? null),
                      primaryColor: brandColorsForEvent(
                        eventQuery.data,
                        orgQuery.data ?? null,
                      )[0],
                      accentColor: brandColorsForEvent(
                        eventQuery.data,
                        orgQuery.data ?? null,
                      )[2],
                    }}
                  />
                </Card>
              ) : null}

              <div className="mt-8">
                <DangerZone
                  rows={[
                    {
                      id: 'download-event-files',
                      label: t('events.danger.downloadLabel'),
                      description: downloadStatus ? (
                        <span aria-live="polite">{downloadStatus}</span>
                      ) : (
                        t('events.danger.downloadDescription')
                      ),
                      action: (
                        // Large events take minutes to export; a silent disabled
                        // button reads as broken (562 MB client event, 31 Jul
                        // 2026), so progress is reported throughout.
                        <NeoButton
                          type="button"
                          variant="surface"
                          disabled={downloading}
                          onClick={() => {
                            setDownloading(true)
                            setDownloadStatus(null)
                            setError(null)
                            downloadEventPackage(
                              eventId!,
                              eventQuery.data?.name ?? 'event',
                              (p) =>
                                setDownloadStatus(
                                  p.phase === 'downloading'
                                    ? t('events.danger.downloadProgress', {
                                        done: p.done,
                                        total: p.total,
                                        size: formatMb(p.bytes),
                                      })
                                    : t('events.danger.savingArchive', {
                                        percent: p.done,
                                      }),
                                ),
                            )
                              .then((result) => {
                                if (!result.saved) {
                                  setDownloadStatus(null)
                                  return
                                }
                                setDownloadStatus(
                                  result.missing.length > 0
                                    ? t('events.danger.savedWithMissing', {
                                        count: result.missing.length,
                                      })
                                    : t('events.danger.saved'),
                                )
                              })
                              .catch((err: unknown) => {
                                setDownloadStatus(null)
                                setError(
                                  err instanceof Error
                                    ? t('events.danger.exportFailedWithMessage', {
                                        message: err.message,
                                      })
                                    : t('events.danger.exportFailed'),
                                )
                              })
                              .finally(() => setDownloading(false))
                          }}
                        >
                          {downloading
                            ? t('events.danger.exporting')
                            : t('events.danger.download')}
                        </NeoButton>
                      ),
                    },
                    ...(resetAllowed && !isArchived
                      ? [{
                          id: 'reset-event-data',
                          label: t('events.danger.resetLabel'),
                          description: t('events.danger.resetDescription'),
                          action: (
                            <NeoButton
                              type="button"
                              variant="destructive"
                              disabled={resetEventDataMutation.isPending || loading}
                              onClick={() => setResetDialogOpen(true)}
                            >
                              {t('events.danger.reset')}
                            </NeoButton>
                          ),
                        }]
                      : []),
                    {
                      id: 'delete-event',
                      label: t('events.danger.deleteLabel'),
                      description: t('events.danger.deleteDescription'),
                      action: (
                        <NeoButton type="button" variant="destructive" disabled={deleteEvent.isPending} onClick={() => setDeleteDialogOpen(true)}>
                          {t('common:delete')}
                        </NeoButton>
                      ),
                    },
                  ]}
                />
              </div>

              {!isArchived && (
                <FormSaveFooter
                  onSave={() => void handleSave()}
                  saving={saving}
                  label={t('events.saveChanges')}
                  dirty={dirty}
                />
              )}
            </>
          )}

          {activeTab === 'tasks' && (
            <>
              {eventId ? (
                <EventTasksPanel eventId={eventId} organizationId={organizationId} />
              ) : null}
            </>
          )}

          {activeTab === 'log' && (
            <>{eventId ? <EventActivityLog eventId={eventId} /> : null}</>
          )}

          <activation.ActivationDialog />

          {resetDialogOpen && eventQuery.data ? (
            <EventResetConfirmDialog
              eventName={eventQuery.data.name}
              confirming={resetEventDataMutation.isPending}
              onCancel={() => setResetDialogOpen(false)}
              onConfirm={() => void handleResetEventData()}
            />
          ) : null}

          {restartDialogOpen && eventQuery.data ? (
            <RecurringRestartConfirmDialog
              eventName={eventQuery.data.name}
              confirming={restartRecurringMutation.isPending}
              onCancel={() => setRestartDialogOpen(false)}
              onConfirm={() => void handleRestartRecurring()}
            />
          ) : null}

          {deleteDialogOpen && eventQuery.data ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <Card className="border-nm-slate-800 w-full max-w-sm space-y-4 border-2 bg-card p-6 shadow-xl">
                <div>
                  <h3 className="text-foreground font-semibold">{t('events.edit.deleteDialogTitle')}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t('events.edit.deleteDialogBody', { name: eventQuery.data.name })}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <NeoButton type="button" variant="surface" disabled={deleteEvent.isPending} onClick={() => setDeleteDialogOpen(false)}>{t('common:cancel')}</NeoButton>
                  <NeoButton type="button" variant="destructive" disabled={deleteEvent.isPending} onClick={() => void handleDeleteEvent()}>
                    {deleteEvent.isPending ? t('events.deleting') : t('events.card.deleteEvent')}
                  </NeoButton>
                </div>
              </Card>
            </div>
          ) : null}

        </>
      )}
    </AdminPageShell>
  )
}
