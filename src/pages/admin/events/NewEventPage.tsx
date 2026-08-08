import { IconCheck, IconCopy } from '@/components/icons'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { EventForm } from '@/components/events/EventForm'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useNotification } from '@/contexts/notification-context'
import { copyToClipboard } from '@/lib/clipboard'
import { useCreateEvent, useUpdateEventStatus } from '@/hooks/use-events'
import { useEventActivationFlow } from '@/hooks/use-event-activation-flow'
import { useGameGroups } from '@/hooks/use-game-groups'
import { useGames } from '@/hooks/use-games'
import { useOrganization } from '@/hooks/use-organization-settings'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { brandColorsFromOrg } from '@/lib/live-event'
import { getEventLinks, qrCodeUrl } from '@/lib/event-links'
import {
  collectEventGameIds,
  emptyEventForm,
  type EventFormValues,
} from '@/lib/event-form-utils'
import type { EventStatus } from '@/types/database'

export function AdminEventsNewPage() {
  const navigate = useNavigate()
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  const gamesQuery = useGames(organizationId)
  const groupsQuery = useGameGroups(organizationId)
  const createEvent = useCreateEvent(organizationId)
  const updateStatus = useUpdateEventStatus(organizationId)
  const { notify } = useNotification()
  const activation = useEventActivationFlow({
    billingPlan: orgQuery.data?.billing_plan,
    organizationId,
    educationalStatus: orgQuery.data?.educational_status,
    onValidationError: notify,
  })

  const [values, setValues] = useState<EventFormValues>(emptyEventForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusPrompt, setStatusPrompt] = useState<{
    eventId: string
    eventName: string
  } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const links = useMemo(() => {
    if (!statusPrompt) return null
    return getEventLinks(statusPrompt.eventId)
  }, [statusPrompt])

  async function handleSave() {
    if (!organizationId || !values.name.trim()) {
      setError('Event name is required.')
      return
    }
    const nonBreak = values.stages.filter((s) => s.type !== 'break')
    if (nonBreak.length === 0) {
      setError('Add at least one non-break stage.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const org = orgQuery.data
      const row = await createEvent.mutateAsync({
        event: {
          organization_id: organizationId,
          name: values.name.trim(),
          location: values.location.trim() || null,
          event_date: values.eventDate
            ? new Date(values.eventDate).toISOString()
            : null,
          status: 'draft',
          team_count: values.teamCount,
          branding_enabled: values.brandingEnabled,
          inventory_enabled: values.inventoryEnabled,
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
      setStatusPrompt({ eventId: row.id, eventName: values.name.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  async function confirmStatus(status: EventStatus) {
    if (!statusPrompt || !organizationId) return
    if (status === 'active') {
      activation.requestActivation(statusPrompt.eventId, statusPrompt.eventName, values.teamCount, async () => {
        await updateStatus.mutateAsync({ eventId: statusPrompt.eventId, status: 'active' })
        navigate('/admin/events', { replace: true })
      })
      return
    }
    try {
      await updateStatus.mutateAsync({ eventId: statusPrompt.eventId, status })
      navigate('/admin/events', { replace: true })
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not set event status')
    }
  }

  async function copyLink(key: string, url: string) {
    if (!(await copyToClipboard(url))) {
      notify('Could not copy — copy it manually')
      return
    }
    setCopied(key)
    window.setTimeout(() => setCopied(null), 2000)
  }

  if (!organizationId) {
    return (
      <AdminPageShell
        title="New event"
        subtitle="Create a scheduled event."
        backTo="/admin/events"
        backLabel="Back to events"
      >
        <p className="text-muted-foreground text-sm">No organization linked.</p>
      </AdminPageShell>
    )
  }

  if (statusPrompt && links) {
    return (
      <AdminPageShell
        title="Event created"
        subtitle="Choose a status and share your links."
        backTo="/admin/events"
        backLabel="Back to events"
      >
        <Card className="border-border/80 mb-8 space-y-4 bg-card p-6 shadow-sm">
          <div>
            <h3 className="text-foreground font-bold">Set event status</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              You can change it any time from the events list.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['draft', 'Draft', 'Keep working on it; nothing is live yet.'],
                ['ready', 'Ready', 'Locked in and waiting for event day.'],
                ['demo', 'Demo', 'A safe trial run with up to two teams.'],
                ['active', 'Active', 'Go live now — teams can join and play.'],
              ] as [EventStatus, string, string][]
            ).map(([s, label, hint]) => (
              <button
                key={s}
                type="button"
                onClick={() => void confirmStatus(s)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  s === 'active'
                    ? 'border-nm-yellow bg-nm-yellow/10 hover:bg-nm-yellow/20'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <p className="text-foreground font-bold">{label}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{hint}</p>
              </button>
            ))}
          </div>
        </Card>
        <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
          <div>
            <h3 className="text-foreground font-bold">Share your links</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Each surface has its own link and QR code; find them again on the
              event page.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {(
              [
                ['facilitator', 'Facilitator', 'Runs the event from a phone or laptop.', links.facilitator],
                ['display', 'Display', 'The big screen everyone watches.', links.display],
                ['join', 'Universal join', 'Print or show this one to the teams.', links.join],
              ] as const
            ).map(([key, label, hint, url]) => (
              <div key={key} className="border-border/80 flex flex-col rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground font-bold">{label}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
                  </div>
                  <img
                    src={qrCodeUrl(url, 160)}
                    alt={`${label} QR code`}
                    width={72}
                    height={72}
                    className="border-border shrink-0 rounded-md border"
                  />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Input readOnly value={url} className="bg-background h-8 min-w-0 flex-1 font-mono text-[11px]" />
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void copyLink(key, url)}>
                    {copied === key ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
                    Copy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <activation.ActivationDialog />
      </AdminPageShell>
    )
  }

  return (
    <AdminPageShell
      title="New event"
      subtitle="Schedule a live team event."
      backTo="/admin/events"
      backLabel="Back to events"
      actions={
        <NeoButton type="button" variant="primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Create Event'}
        </NeoButton>
      }
    >
      {error ? (
        <p className="text-destructive mb-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <EventForm
        organizationId={organizationId}
        values={values}
        onChange={setValues}
        games={gamesQuery.data ?? []}
        groups={groupsQuery.data ?? []}
        orgDefaults={orgQuery.data ?? null}
      />
      <FormSaveFooter
        onSave={() => void handleSave()}
        saving={saving}
        label="Create Event"
      />
    </AdminPageShell>
  )
}
