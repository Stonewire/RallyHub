import { IconCheck, IconCopy, IconDownload, IconExternal } from '@/components/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { getTabletLink } from '@/lib/tablet-link'
import { qrCodeUrl } from '@/lib/event-links'
import { copyToClipboard } from '@/lib/clipboard'

type TabletLinkEditorProps = {
  subdomain: string
  disabled?: boolean
}

export function TabletLinkEditor({ subdomain, disabled = false }: TabletLinkEditorProps) {
  const { t } = useTranslation('admin')
  const fullLink = getTabletLink({ subdomain })
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    if (!(await copyToClipboard(fullLink))) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-start gap-3">
      <img
        src={qrCodeUrl(fullLink, 160)}
        alt={t('settings.tabletQrAlt')}
        width={110}
        height={110}
        className="border-border bg-nm-slate-100 size-[110px] shrink-0 rounded-sm border border-dashed p-1"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <Label>{t('settings.tabletLink')}</Label>
        <p className="text-muted-foreground truncate text-[11px]" title={fullLink}>{fullLink}</p>
        <div className="flex gap-1.5">
          <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={() => void copyLink()} aria-label={t('settings.tabletCopyLink')}>
            {copied ? <IconCheck className="size-3.5" /> : <IconCopy className="size-3.5" />}
          </Button>
          {disabled ? (
            <Button type="button" variant="ghost" size="icon-sm" disabled aria-label={t('settings.tabletOpenLink')}>
              <IconExternal className="size-3.5" />
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="icon-sm" asChild>
              <a href={fullLink} target="_blank" rel="noreferrer" aria-label={t('settings.tabletOpenLink')}>
                <IconExternal className="size-3.5" />
              </a>
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} asChild={!disabled}>
            {disabled ? (
              <span aria-label={t('settings.tabletDownloadQr')}><IconDownload className="size-3.5" /></span>
            ) : (
              <a href={qrCodeUrl(fullLink, 1024)} download="rallyhub-tablet-qr.png" aria-label={t('settings.tabletDownloadQr')}>
                <IconDownload className="size-3.5" />
              </a>
            )}
          </Button>
        </div>
        {disabled ? <p className="text-muted-foreground text-[10px]">{t('settings.tabletLinkDisabledHint')}</p> : null}
      </div>
    </div>
  )
}
