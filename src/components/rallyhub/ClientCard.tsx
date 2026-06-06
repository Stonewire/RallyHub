import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { formatClientPlanLabel } from '@/lib/client-plans'
import { organizationInitials } from '@/lib/org-avatar'
import { cn } from '@/lib/utils'

export type ClientCardData = {
  id: string
  name: string
  logo_url: string | null
  email: string | null
  contact_email: string | null
  billing_plan: string | null
  completedEvents: number
  upcomingEvents: number
}

type ClientCardProps = {
  client: ClientCardData
  className?: string
}

function clientEmail(client: ClientCardData) {
  return client.email?.trim() || client.contact_email?.trim() || null
}

export function ClientCard({ client, className }: ClientCardProps) {
  const email = clientEmail(client)
  const initials = organizationInitials(client.name)

  return (
    <article
      className={cn(
        'border-border/80 bg-card flex h-full min-h-[11rem] flex-col gap-3 rounded-lg border p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {client.logo_url ? (
          <img
            src={client.logo_url}
            alt=""
            className="border-border/80 size-11 shrink-0 rounded-full border object-cover"
          />
        ) : (
          <div
            className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            aria-hidden
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-foreground line-clamp-2 text-sm font-semibold leading-snug">
            {client.name}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Plan: {formatClientPlanLabel(client.billing_plan)}
          </p>
        </div>
      </div>

      <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/30 rounded-md px-2.5 py-2">
          <p className="text-foreground text-base font-semibold tabular-nums">
            {client.completedEvents}
          </p>
          <p>Completed events</p>
        </div>
        <div className="bg-muted/30 rounded-md px-2.5 py-2">
          <p className="text-foreground text-base font-semibold tabular-nums">
            {client.upcomingEvents}
          </p>
          <p>Upcoming events</p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        {email ? (
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <a href={`mailto:${encodeURIComponent(email)}`}>Contact</a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="flex-1" disabled>
            Contact
          </Button>
        )}
        <Button variant="default" size="sm" className="flex-1" asChild>
          <Link to={`/admin/clients/${client.id}`}>View</Link>
        </Button>
      </div>
    </article>
  )
}
