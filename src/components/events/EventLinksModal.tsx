import { Link2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EventLinksPanel } from '@/components/events/EventLinksPanel'
import type { TenantPublicOrg } from '@/lib/tenant'

type EventLinksModalProps = {
  eventId: string
  eventName: string
  organization?: Pick<TenantPublicOrg, 'subdomain' | 'custom_domain'> | null
  onClose: () => void
}

export function EventLinksModal({
  eventId,
  eventName,
  organization,
  onClose,
}: EventLinksModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="border-border/80 max-h-[90vh] w-full max-w-3xl overflow-auto bg-card p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link2 className="text-foreground size-5" />
            <h2 className="text-foreground text-lg font-semibold">Event links</h2>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <p className="text-muted-foreground mb-6 text-sm">{eventName}</p>
        <EventLinksPanel eventId={eventId} organization={organization} />
      </Card>
    </div>
  )
}
