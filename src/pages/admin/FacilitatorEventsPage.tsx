import { IconCheck, IconCopy, IconExternal, IconQr } from '@/components/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { NeoButton, NeoCard } from '@/components/neo-minimal'
import { useAuth } from '@/contexts/auth-context'
import {
  EVENT_STATUS_LABELS,
  groupEventsByStatus,
  useEvents,
  type EventRow,
} from '@/hooks/use-events'
import { copyToClipboard, getEventLinks, qrCodeUrl } from '@/lib/event-links'
import { profileDisplayName } from '@/lib/auth-routes'

export function FacilitatorEventsPage() {
  const { profile } = useAuth()
  const orgId = profile?.organization_id ?? null
  const { data: events = [], isLoading } = useEvents(orgId)
  const name = profileDisplayName(profile)

  const groups = groupEventsByStatus(events)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Events</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {name ? `Signed in as ${name}. ` : ''}Open the facilitator link to run an event, or
          share the teams link and QR code so players can join.
        </p>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading your events…</p>
      ) : events.length === 0 ? (
        <NeoCard className="p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No events yet. Once your organisation creates one, it will appear here.
          </p>
        </NeoCard>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.status}>
              <h2 className="text-muted-foreground mb-3 text-xs font-bold uppercase tracking-wide">
                {EVENT_STATUS_LABELS[group.status]}
              </h2>
              <div className="space-y-3">
                {group.events.map((event) => (
                  <FacilitatorEventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function FacilitatorEventCard({ event }: { event: EventRow }) {
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const links = getEventLinks(event.id)

  async function copy(key: string, url: string) {
    try {
      await copyToClipboard(url)
      setCopied(key)
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const eventDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <NeoCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-foreground font-semibold">{event.name}</h3>
          {eventDate ? <p className="text-muted-foreground text-xs">{eventDate}</p> : null}
        </div>
        <NeoButton variant="primary" size="sm" asChild>
          <Link to={`/facilitator/${event.id}`}>
            Open facilitator
            <IconExternal className="size-4" aria-hidden />
          </Link>
        </NeoButton>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <NeoButton variant="surface" size="sm" onClick={() => void copy('facilitator', links.facilitator)}>
          {copied === 'facilitator' ? <IconCheck className="size-4" aria-hidden /> : <IconCopy className="size-4" aria-hidden />}
          Facilitator link
        </NeoButton>
        <NeoButton variant="surface" size="sm" onClick={() => void copy('display', links.display)}>
          {copied === 'display' ? <IconCheck className="size-4" aria-hidden /> : <IconCopy className="size-4" aria-hidden />}
          Display link
        </NeoButton>
        <NeoButton variant="surface" size="sm" onClick={() => void copy('join', links.join)}>
          {copied === 'join' ? <IconCheck className="size-4" aria-hidden /> : <IconCopy className="size-4" aria-hidden />}
          Teams link
        </NeoButton>
        <NeoButton
          variant="ghost"
          size="sm"
          onClick={() => setShowQr((v) => !v)}
          aria-expanded={showQr}
        >
          <IconQr className="size-4" aria-hidden />
          {showQr ? 'Hide QR' : 'Teams QR'}
        </NeoButton>
      </div>

      {showQr ? (
        <div className="mt-4 flex flex-col items-center gap-2 border-t border-[var(--nm-border)] pt-4">
          <img
            src={qrCodeUrl(links.join, 200)}
            alt={`QR code for teams to join ${event.name}`}
            width={200}
            height={200}
            className="rounded-lg bg-white p-2"
          />
          <p className="text-muted-foreground break-all text-center text-xs">{links.join}</p>
        </div>
      ) : null}
    </NeoCard>
  )
}
