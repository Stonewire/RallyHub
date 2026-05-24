import { useParams } from 'react-router-dom'

import { AdminPageShell } from '@/components/layout/AdminPageShell'
import { PlaceholderPage } from '@/components/PlaceholderPage'

function AdminDocPage({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <AdminPageShell title={title} subtitle={subtitle}>
      <p className="text-muted-foreground max-w-prose leading-relaxed">
        Placeholder — wire up data and actions here following the RallyHub admin
        design system (typography hierarchy, muted copy, neutral surfaces, accent
        only on primary actions).
      </p>
    </AdminPageShell>
  )
}

function AdminDetailPlaceholder({
  title,
  subtitle,
  meta,
}: {
  title: string
  subtitle?: string
  meta: Record<string, string | undefined>
}) {
  const entries = Object.entries(meta).filter(
    ([, v]) => v != null && v !== '',
  )
  return (
    <AdminPageShell title={title} subtitle={subtitle}>
      <dl className="text-muted-foreground space-y-2 text-sm">
        {entries.map(([key, val]) => (
          <div key={key}>
            <dt className="text-foreground text-xs font-medium uppercase tracking-wider opacity-75">
              {key}
            </dt>
            <dd className="font-mono text-sm">{String(val)}</dd>
          </div>
        ))}
      </dl>
    </AdminPageShell>
  )
}

export function AdminGamesNewPage() {
  return (
    <AdminDocPage title="New game" subtitle="Create a new game definition." />
  )
}

export function AdminGameDetailPage() {
  const { gameId } = useParams()
  return (
    <AdminDetailPlaceholder
      title="Game detail"
      subtitle="Edit settings, rounds, and scoring."
      meta={{ 'Game ID': gameId ?? '' }}
    />
  )
}

export function AdminEventsNewPage() {
  return (
    <AdminDocPage
      title="New event"
      subtitle="Create a scheduled event and assign facilitators."
    />
  )
}

export function AdminEventDetailPage() {
  const { eventId } = useParams()
  return (
    <AdminDetailPlaceholder
      title="Event detail"
      subtitle="Runbooks, participants, and session controls."
      meta={{ 'Event ID': eventId ?? '' }}
    />
  )
}

export function AdminSupportPage() {
  return (
    <AdminDocPage
      title="Support"
      subtitle="Reach the RallyHub team and browse help resources."
    />
  )
}

export function RallyHubOverviewPage() {
  return (
    <PlaceholderPage
      title="RallyHub overview"
      description="Client-facing hub home."
    />
  )
}

export function RallyHubClientsPage() {
  return (
    <PlaceholderPage
      title="Clients"
      description="Organizations you work with."
    />
  )
}

export function RallyHubClientDetailPage() {
  const { clientId } = useParams()
  return (
    <PlaceholderPage
      title="Client"
      meta={{ 'Client ID': clientId }}
      description="Client profile, contracts, and assigned games."
    />
  )
}

export function RallyHubGamesPage() {
  return (
    <PlaceholderPage
      title="Games"
      description="Games available to your organization."
    />
  )
}

export function RallyHubGameDetailPage() {
  const { gameId } = useParams()
  return (
    <PlaceholderPage
      title="Game"
      meta={{ 'Game ID': gameId }}
      description="Game overview for client users."
    />
  )
}

export function RallyHubSupportPage() {
  return (
    <PlaceholderPage
      title="Support"
      description="Help center and contact options."
    />
  )
}

export function FacilitatorEventPage() {
  const { eventId } = useParams()
  return (
    <PlaceholderPage
      title="Facilitator"
      meta={{ 'Event ID': eventId }}
      description="Live facilitation controls for this event."
    />
  )
}

export function DisplayEventPage() {
  const { eventId } = useParams()
  return (
    <PlaceholderPage
      title="Display"
      meta={{ 'Event ID': eventId }}
      description="Fullscreen read-only display / scoreboard view."
    />
  )
}

export function JoinEventPage() {
  const { eventId } = useParams()
  return (
    <PlaceholderPage
      title="Join event"
      meta={{ 'Event ID': eventId }}
      description="Participant join flow (QR landing, team pick, etc.)."
    />
  )
}

export function PlayTokenPage() {
  const { token } = useParams()
  return (
    <PlaceholderPage
      title="Player session"
      meta={{ Token: token }}
      description="In-game experience for a participant or team session."
    />
  )
}

export function TabletPage() {
  return (
    <PlaceholderPage
      title="Tablet"
      description="Dedicated tablet UI (timers, buzzers, judging)."
    />
  )
}
