import { Link } from 'react-router-dom'

import { IconExternal, IconSend } from '@/components/icons'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
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
  is_demo?: boolean | null
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
    <Card
      className={cn(
        'border-border/80 bg-card flex h-full min-h-[11rem] flex-col gap-3 p-4 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-nm-slate-400 hover:shadow-md',
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
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                {client.unpaidInvoiceCount} unpaid
              </span>
            ) : null}
            {trial ? (
              <span className="bg-nm-yellow/40 text-nm-charcoal dark:text-nm-yellow shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                {trial}
              </span>
            ) : null}
            {client.is_demo ? (
              <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                Demo
              </span>
            ) : null}
            {client.trial_review_needed ? (
              <span className="text-destructive shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                Review
              </span>
            ) : null}
          </div>
          {/* A demo org bills nobody, so a plan line would be a lie. */}
          <p className="text-muted-foreground mt-1 text-xs">
            {client.is_demo
              ? 'Demo account · no billing'
              : `Plan: ${formatClientPlanLabel(client.billing_plan)} (${formatBillingPeriodLabel(
                  normalizeBillingPeriod(client.billing_period),
                )})`}
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
          <NeoButton variant="surface" size="sm" className="flex-1 justify-center" asChild>
            <a href={`mailto:${encodeURIComponent(email)}`}>
              <IconSend className="size-3.5" aria-hidden />
              Contact
            </a>
          </NeoButton>
        ) : (
          <NeoButton variant="surface" size="sm" className="flex-1 justify-center" disabled>
            <IconSend className="size-3.5" aria-hidden />
            Contact
          </NeoButton>
        )}
        <NeoButton variant="accent" size="sm" className="flex-1 justify-center" asChild>
          <Link to={`/admin/clients/${client.id}`}>
            <IconExternal className="size-3.5" aria-hidden />
            View
          </Link>
        </NeoButton>
      </div>
    </Card>
  )
}
