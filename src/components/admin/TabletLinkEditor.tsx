import { Check, Copy, Download, ExternalLink } from 'lucide-react'
import { useState } from 'react'

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
        alt="Tablet QR code"
        width={110}
        height={110}
        className="border-border bg-nm-slate-100 size-[110px] shrink-0 rounded-sm border border-dashed p-1"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <Label>Tablet link</Label>
        <p className="text-muted-foreground truncate text-[11px]" title={fullLink}>{fullLink}</p>
        <div className="flex gap-1.5">
          <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={() => void copyLink()} aria-label="Copy tablet link">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
          {disabled ? (
            <Button type="button" variant="ghost" size="icon-sm" disabled aria-label="Open tablet link">
              <ExternalLink className="size-3.5" />
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="icon-sm" asChild>
              <a href={fullLink} target="_blank" rel="noreferrer" aria-label="Open tablet link">
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} asChild={!disabled}>
            {disabled ? (
              <span aria-label="Download tablet QR code"><Download className="size-3.5" /></span>
            ) : (
              <a href={qrCodeUrl(fullLink, 1024)} download="rallyhub-tablet-qr.png" aria-label="Download tablet QR code">
                <Download className="size-3.5" />
              </a>
            )}
          </Button>
        </div>
        {disabled ? <p className="text-muted-foreground text-[10px]">Set a private tablet password to enable this link.</p> : null}
      </div>
    </div>
  )
}
