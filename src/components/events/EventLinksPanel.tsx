import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconExternal,
  IconQr,
} from '@/components/icons'
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
  type EventLinksPdfBranding,
} from '@/lib/event-links'
import { getTabletLink } from '@/lib/tablet-link'
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

/** The PDF export, so a page can host it in a card header instead. */
export function EventQrDownloadButton({
  eventId,
  eventName,
  eventSlug,
  organization,
  branding,
}: Pick<
  EventLinksPanelProps,
  'eventId' | 'eventName' | 'eventSlug' | 'organization' | 'branding'
>) {
  const { t } = useTranslation('admin')
  const [downloading, setDownloading] = useState(false)
  const links = getEventLinks(eventId, {
    clientSlug: organization?.subdomain,
    eventSlug,
  })
  return (
    <NeoButton
      type="button"
      variant="accent"
      disabled={downloading}
      onClick={() => {
        setDownloading(true)
        void downloadAllEventQrsPdf(links, branding ?? { eventName }).finally(() =>
          setDownloading(false),
        )
      }}
    >
      <IconDownload className="size-4" />
      {downloading ? t('events.links.buildingPdf') : t('events.links.downloadAllQrPdf')}
    </NeoButton>
  )
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
  const { t } = useTranslation('admin')
  const links = getEventLinks(eventId, {
    clientSlug: organization?.subdomain,
    eventSlug,
  })
  const [copied, setCopied] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)

  // Labels describe who the link is for. The keys stay raw (they map to
  // routes); only what the organiser reads is translated.
  const linkLabels: Record<string, string> = {
    facilitator: t('events.links.facilitator'),
    display: t('events.links.display'),
    join: t('events.links.join'),
  }

  /**
   * The three event links, plus the org's tablet kiosk when we know the
   * subdomain.
   *
   * The tablet QR used to live only on the Organisation page, which event
   * managers cannot open at all, so the person setting the room up could not
   * reach the code for the tablets they were setting up. It belongs with the
   * other things you print before an event.
   */
  const linkCards = [
    ...EVENT_LINK_ORDER.map((key) => ({
      key: key as string,
      label: linkLabels[key] ?? EVENT_LINK_LABELS[key],
      url: links[key],
    })),
    ...(organization?.subdomain
      ? [
          {
            key: 'tablet',
            label: t('events.links.tablet'),
            url: getTabletLink({ subdomain: organization.subdomain }),
          },
        ]
      : []),
  ]

  async function handleCopy(key: string, url: string) {
    await copyToClipboard(url)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 2000)
  }

  const pdfBranding: EventLinksPdfBranding = branding ?? { eventName }

  return (
    <div className="space-y-6">
      <div
        className={
          compact ? 'space-y-4' : 'grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4'
        }
      >
        {linkCards.map(({ key, label, url }) => (
          // No card around each link: these already sit inside a panel or a
          // modal, so the extra border and shadow was a box inside a box.
          <div key={key} className="flex flex-col gap-3">
            <Label className="text-foreground block text-center text-sm font-bold">
              {label}
            </Label>
            <img
              src={qrCodeUrl(url, 200)}
              alt={t('events.links.qrAlt', { label })}
              width={200}
              height={200}
              className="mx-auto rounded-lg bg-white p-2"
            />
            {/* Grows to fill, so a longer URL does not shove the buttons of one
                column below the others. */}
            <p className="text-muted-foreground min-h-8 flex-1 break-all font-mono text-xs">
              {url}
            </p>
            {/* Stacked full-width actions: three pills squeezed onto one row
                (px-0, icons touching labels) read as broken buttons at this
                column width. */}
            <div className="flex flex-col gap-1.5">
              <NeoButton
                type="button"
                size="sm"
                variant="surface"
                className="w-full justify-center"
                onClick={() => void handleCopy(key, url)}
              >
                {copied === key ? (
                  <IconCheck className="size-3.5" />
                ) : (
                  <IconCopy className="size-3.5" />
                )}
                {copied === key ? t('events.links.copied') : t('events.links.copyLink')}
              </NeoButton>
              <NeoButton type="button" size="sm" variant="surface" className="w-full justify-center" asChild>
                <Link to={url} target="_blank" rel="noreferrer">
                  <IconExternal className="size-3.5" />
                  {t('events.links.open')}
                </Link>
              </NeoButton>
              <NeoButton
                type="button"
                size="sm"
                variant="surface"
                className="w-full justify-center"
                title={t('events.links.downloadQrTitle')}
                onClick={() =>
                  void downloadQrPng(url, `rallyhub-${key}-${eventId}.png`)
                }
              >
                <IconQr className="size-3.5" />
                {t('events.links.downloadQr')}
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
          <IconDownload className="size-4" />
          {downloadingAll ? t('events.links.buildingPdf') : t('events.links.downloadAllQrPdf')}
        </NeoButton>
      )}
    </div>
  )
}
