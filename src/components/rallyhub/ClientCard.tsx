import { Link } from 'react-router-dom'

import { NeoButton, NeoCard } from '@/components/neo-minimal'
import {
  formatBillingPeriodLabel,
  formatClientPlanLabel,
  normalizeBillingPeriod,
} from '@/lib/client-plans'
import { organizationInitials } from '@/lib/org-avatar'
import { cn } from '@/lib/utils'

export type ClientCardData = {
  id: string
  name: string
  logo_url: string | null
  email: string | null
  contact_email: string | null
  billing_plan: string | null
  billing_period?: string | null
  account_status?: string | null
  trial_ends_at?: string | null
  trial_review_needed?: boolean | null
  completedEvents: number
  upcomingEvents: number
  unpaidInvoiceCount?: number
}

type ClientCardProps = {
  client: ClientCardData
  className?: string
}

function clientEmail(client: ClientCardData) {
  return client.email?.trim() || client.contact_email?.trim() || null
}

/** Trial label for the super-admin card, e.g. "Trial · 12d left" or "Trial ended". */
function trialLabel(client: ClientCardData): string | null {
  if (client.account_status !== 'trial') return null
  if (!client.trial_ends_at) return 'Trial'
  const days = Math.ceil(
    (new Date(client.trial_ends_at).getTime() - Date.now()) / 86_400_000,
  )
  return days > 0 ? `Trial · ${days}d left` : 'Trial ended'
}

export function ClientCard({ client, className }: ClientCardProps) {
  const email = clientEmail(client)
  const initials = organizationInitials(client.name)
  const trial = trialLabel(client)

  return (
    <NeoCard
      className={cn(
        'flex h-full min-h-[11rem] flex-col gap-3 p-4',
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
          <div className="flex flex-wrap items-start gap-2">
            <p className="text-foreground line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug">
              {client.name}
            </p>
            {(client.unpaidInvoiceCount ?? 0) > 0 ? (
              <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                {client.unpaidInvoiceCount} unpaid
              </span>
            ) : null}
            {trial ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {trial}
              </span>
            ) : null}
            {client.trial_review_needed ? (
              <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                Review
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Plan: {formatClientPlanLabel(client.billing_plan)} (
            {formatBillingPeriodLabel(normalizeBillingPeriod(client.billing_period))})
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
          <NeoButton variant="surface" size="sm" className="flex-1" asChild>
            <a href={`mailto:${encodeURIComponent(email)}`}>Contact</a>
          </NeoButton>
        ) : (
          <NeoButton variant="surface" size="sm" className="flex-1" disabled>
            Contact
          </NeoButton>
        )}
        <NeoButton variant="primary" size="sm" className="flex-1" asChild>
          <Link to={`/admin/clients/${client.id}`}>View</Link>
        </NeoButton>
      </div>
    </NeoCard>
  )
}
