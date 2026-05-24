import { Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  copyToClipboard,
  downloadQrPng,
  EVENT_LINK_LABELS,
  getEventLinks,
  qrCodeUrl,
  type EventLinkKey,
} from '@/lib/event-links'
import type { TenantPublicOrg } from '@/lib/tenant'

const LINK_ORDER: EventLinkKey[] = ['facilitator', 'display', 'join']

type EventLinksPanelProps = {
  eventId: string
  organization?: Pick<TenantPublicOrg, 'subdomain' | 'custom_domain'> | null
  compact?: boolean
}

export function EventLinksPanel({
  eventId,
  organization,
  compact,
}: EventLinksPanelProps) {
  const links = getEventLinks(eventId, organization)
  const [copied, setCopied] = useState<EventLinkKey | null>(null)

  async function handleCopy(key: EventLinkKey) {
    await copyToClipboard(links[key])
    setCopied(key)
    window.setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className={compact ? 'space-y-4' : 'grid gap-6 sm:grid-cols-3'}>
      {LINK_ORDER.map((key) => (
        <div
          key={key}
          className="border-border/80 space-y-3 rounded-lg border bg-card p-4 shadow-sm"
        >
          <Label className="text-foreground font-semibold">
            {EVENT_LINK_LABELS[key]}
          </Label>
          <img
            src={qrCodeUrl(links[key], 160)}
            alt={`QR code for ${EVENT_LINK_LABELS[key]}`}
            width={160}
            height={160}
            className="mx-auto rounded border bg-white"
          />
          <p className="text-muted-foreground break-all font-mono text-xs">
            {links[key]}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleCopy(key)}
            >
              {copied === key ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              Copy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void downloadQrPng(links[key], `rallyhub-${key}-${eventId}.png`)
              }
            >
              <Download className="size-4" />
              QR PNG
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
