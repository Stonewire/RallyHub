import { Check, Copy, Download, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { NeoButton } from '@/components/neo-minimal'
import { Label } from '@/components/ui/label'
import {
  copyToClipboard,
  downloadAllEventQrsPdf,
  downloadQrPng,
  EVENT_LINK_LABELS,
  EVENT_LINK_ORDER,
  getEventLinks,
  qrCodeUrl,
  type EventLinkKey,
  type EventLinksPdfBranding,
} from '@/lib/event-links'
import type { TenantPublicOrg } from '@/lib/tenant'

type EventLinksPanelProps = {
  eventId: string
  eventName: string
  eventSlug?: string | null
  organization?: Pick<TenantPublicOrg, 'subdomain' | 'custom_domain'> | null
  branding?: EventLinksPdfBranding
  compact?: boolean
  /** The modal hosts this action in its header instead, to save a row. */
  hideDownloadAll?: boolean
}

export function EventLinksPanel({
  eventId,
  eventName,
  eventSlug,
  organization,
  branding,
  compact,
  hideDownloadAll,
}: EventLinksPanelProps) {
  const links = getEventLinks(eventId, {
    clientSlug: organization?.subdomain,
    eventSlug,
  })
  const [copied, setCopied] = useState<EventLinkKey | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)

  async function handleCopy(key: EventLinkKey) {
    await copyToClipboard(links[key])
    setCopied(key)
    window.setTimeout(() => setCopied(null), 2000)
  }

  const pdfBranding: EventLinksPdfBranding = branding ?? { eventName }

  return (
    <div className="space-y-6">
      <div className={compact ? 'space-y-4' : 'grid gap-6 sm:grid-cols-3'}>
        {EVENT_LINK_ORDER.map((key) => (
          // No card around each link: these already sit inside a panel or a
          // modal, so the extra border and shadow was a box inside a box.
          <div key={key} className="space-y-3">
            <Label className="text-foreground block text-center text-sm font-bold">
              {EVENT_LINK_LABELS[key]}
            </Label>
            <img
              src={qrCodeUrl(links[key], 200)}
              alt={`QR code for ${EVENT_LINK_LABELS[key]}`}
              width={200}
              height={200}
              className="mx-auto rounded-lg bg-white p-2"
            />
            <p className="text-muted-foreground break-all font-mono text-xs">
              {links[key]}
            </p>
            {/* Three equal columns rather than wrapping flex: the labels are
                short enough to sit on one line at any card width. */}
            <div className="grid grid-cols-3 gap-1.5">
              <NeoButton
                type="button"
                size="sm"
                variant="surface"
                className="w-full justify-center px-0"
                onClick={() => void handleCopy(key)}
              >
                {copied === key ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                Copy
              </NeoButton>
              <NeoButton type="button" size="sm" variant="surface" className="w-full justify-center px-0" asChild>
                <Link to={links[key]} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open
                </Link>
              </NeoButton>
              <NeoButton
                type="button"
                size="sm"
                variant="surface"
                className="w-full justify-center px-0"
                title="Download this QR as a PNG"
                onClick={() =>
                  void downloadQrPng(links[key], `rallyhub-${key}-${eventId}.png`)
                }
              >
                <Download className="size-3.5" />
                QR
              </NeoButton>
            </div>
          </div>
        ))}
      </div>
      {hideDownloadAll ? null : (
      <NeoButton
          type="button"
          variant="surface"
          disabled={downloadingAll}
          onClick={() => {
            setDownloadingAll(true)
            void downloadAllEventQrsPdf(links, pdfBranding).finally(() =>
              setDownloadingAll(false),
            )
          }}
        >
          <Download className="size-4" />
          {downloadingAll ? 'Building PDF…' : 'Download all QR codes (PDF)'}
        </NeoButton>
      )}
    </div>
  )
}
