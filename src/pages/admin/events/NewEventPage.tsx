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
import { Label } from '@/components/ui/label'
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
          <p className="text-foreground font-medium">Set event status</p>
          <div className="flex flex-wrap gap-2">
            {(['draft', 'ready', 'demo', 'active'] as EventStatus[]).map((s) => (
              <NeoButton key={s} type="button" variant="primary" onClick={() => void confirmStatus(s)}>
                {s === 'demo' ? 'Demo' : s.charAt(0).toUpperCase() + s.slice(1)}
              </NeoButton>
            ))}
          </div>
        </Card>
        <Card className="border-border/80 space-y-6 bg-card p-6 shadow-sm">
          <h3 className="text-foreground font-semibold">Generated links</h3>
          {(
            [
              ['facilitator', 'Facilitator', links.facilitator],
              ['display', 'Display', links.display],
              ['join', 'Universal join', links.join],
            ] as const
          ).map(([key, label, url]) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <div className="flex flex-wrap items-start gap-3">
                <Input readOnly value={url} className="bg-background flex-1 font-mono text-xs" />
                <Button type="button" variant="outline" onClick={() => void copyLink(key, url)}>
                  {copied === key ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
                  Copy
                </Button>
                <img src={qrCodeUrl(url, 120)} alt="" width={96} height={96} className="rounded border" />
              </div>
            </div>
          ))}
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
