import { Check, Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AccentButton } from '@/components/admin/AccentButton'
import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { FormSaveFooter } from '@/components/layout/FormSaveFooter'
import { EventForm } from '@/components/events/EventForm'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateEvent } from '@/hooks/use-events'
import { useGameGroups } from '@/hooks/use-game-groups'
import { useGames } from '@/hooks/use-games'
import { useOrganization } from '@/hooks/use-organization-settings'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { emptyEventForm, type EventFormValues } from '@/lib/event-form-utils'
import type { EventStatus } from '@/types/database'

function qrUrl(link: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(link)}`
}

export function AdminEventsNewPage() {
  const navigate = useNavigate()
  const organizationId = useOrganizationId()
  const orgQuery = useOrganization(organizationId)
  const gamesQuery = useGames(organizationId)
  const groupsQuery = useGameGroups(organizationId)
  const createEvent = useCreateEvent(organizationId)

  const [values, setValues] = useState<EventFormValues>(emptyEventForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusPrompt, setStatusPrompt] = useState<{ eventId: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const links = useMemo(() => {
    if (!statusPrompt) return null
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const id = statusPrompt.eventId
    return {
      facilitator: `${base}/facilitator/${id}`,
      display: `${base}/display/${id}`,
      join: `${base}/join/${id}`,
    }
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
          event_date: values.eventDate
            ? new Date(values.eventDate).toISOString()
            : null,
          status: 'draft',
          team_count: values.teamCount,
          branding_enabled: values.brandingEnabled,
          logo_url: values.brandingEnabled
            ? values.logoUrl
            : org?.logo_url ?? null,
          brand_colors: values.brandingEnabled
            ? values.brandColors
            : [
                org?.primary_color,
                org?.secondary_color,
                org?.accent_color,
              ].filter((c): c is string => Boolean(c)),
          teams_config: values.teams,
          stages_config: values.stages,
        },
        gameIds: values.selectedGameIds,
      })
      setStatusPrompt({ eventId: row.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  async function confirmStatus(status: EventStatus) {
    if (!statusPrompt || !organizationId) return
    const { supabase } = await import('@/lib/supabase')
    await supabase.from('events').update({ status }).eq('id', statusPrompt.eventId)
    navigate('/admin/events', { replace: true })
  }

  async function copyLink(key: string, url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 2000)
  }

  if (!organizationId) {
    return (
      <AdminPageShell title="New event" subtitle="Create a scheduled event.">
        <p className="text-muted-foreground text-sm">No organization linked.</p>
      </AdminPageShell>
    )
  }

  if (statusPrompt && links) {
    return (
      <AdminPageShell
        title="Event created"
        subtitle="Choose a status and share your links."
      >
        <Card className="border-border/80 mb-8 space-y-4 bg-card p-6 shadow-sm">
          <p className="text-foreground font-medium">Set event status</p>
          <div className="flex flex-wrap gap-2">
            {(['draft', 'ready', 'active'] as EventStatus[]).map((s) => (
              <AccentButton key={s} type="button" onClick={() => void confirmStatus(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </AccentButton>
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
                  {copied === key ? <Check className="size-4" /> : <Copy className="size-4" />}
                  Copy
                </Button>
                <img src={qrUrl(url)} alt="" width={96} height={96} className="rounded border" />
              </div>
            </div>
          ))}
        </Card>
      </AdminPageShell>
    )
  }

  return (
    <AdminPageShell
      title="New event"
      subtitle="Schedule a live team event."
      actions={
        <AccentButton type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Create Event'}
        </AccentButton>
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
