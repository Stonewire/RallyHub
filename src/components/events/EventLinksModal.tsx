import { IconClose, IconDownload, IconLink } from '@/components/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EventLinksPanel } from '@/components/events/EventLinksPanel'
import { downloadAllEventQrsPdf, getEventLinks, type EventLinksPdfBranding } from '@/lib/event-links'
import type { TenantPublicOrg } from '@/lib/tenant'

type EventLinksModalProps = {
  eventId: string
  eventName: string
  eventSlug?: string | null
  organization?: Pick<TenantPublicOrg, 'subdomain' | 'custom_domain'> | null
  branding?: EventLinksPdfBranding
  onClose: () => void
}

export function EventLinksModal({
  eventId,
  eventName,
  eventSlug,
  organization,
  branding,
  onClose,
}: EventLinksModalProps) {
  const { t } = useTranslation('admin')
  const [downloadingAll, setDownloadingAll] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="border-border/80 max-h-[90vh] w-full max-w-3xl overflow-auto bg-card p-6 shadow-xl">
        {/* The event name is not repeated here: the card you opened this from
            already names it, and it pushed the links down for nothing. */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconLink className="text-foreground size-4" />
            <h2 className="text-foreground text-lg font-semibold">{t('events.links.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Hosted here rather than under the QR codes: the header had empty
                space on the right and this saves the modal a whole row. */}
            <NeoButton
              type="button"
              variant="accent"
              size="sm"
              disabled={downloadingAll}
              onClick={() => {
                setDownloadingAll(true)
                void downloadAllEventQrsPdf(
                  getEventLinks(eventId, {
                    clientSlug: organization?.subdomain,
                    eventSlug,
                  }),
                  branding ?? { eventName },
                ).finally(() => setDownloadingAll(false))
              }}
            >
              <IconDownload className="size-3.5" />
              {downloadingAll ? t('events.links.buildingPdf') : t('events.links.downloadAllQr')}
            </NeoButton>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('events.links.closeAria')}
              onClick={onClose}
            >
              <IconClose className="size-4" />
            </Button>
          </div>
        </div>
        <EventLinksPanel
          eventId={eventId}
          eventName={eventName}
          eventSlug={eventSlug}
          organization={organization}
          branding={branding ?? { eventName }}
          hideDownloadAll
        />
      </Card>
    </div>
  )
}
