import { useMemo } from 'react'

import { Label } from '@/components/ui/label'
import {
  getTabletLink,
  getTabletLinkPrefix,
  validateTabletCode,
} from '@/lib/tablet-link'
import { qrCodeUrl } from '@/lib/event-links'

type TabletLinkEditorProps = {
  orgName: string
  tabletCode: string
  onCodeChange: (code: string) => void
  customDomain?: string | null
  subdomain: string
}

export function TabletLinkEditor({
  orgName,
  tabletCode,
  onCodeChange,
  customDomain,
  subdomain,
}: TabletLinkEditorProps) {
  const prefix = getTabletLinkPrefix({
    name: orgName,
    subdomain,
    custom_domain: customDomain,
  })
  const validation = validateTabletCode(tabletCode)
  const fullLink = useMemo(() => {
    if (validation) return ''
    return getTabletLink({
      name: orgName,
      tablet_slug: tabletCode,
      subdomain,
      custom_domain: customDomain,
    })
  }, [orgName, tabletCode, subdomain, customDomain, validation])

  return (
    <div className="space-y-3">
      <Label>Tablet link</Label>
      <p className="text-muted-foreground text-xs">
        Shared kiosk URL for your organization. The gray part is fixed from your organization
        name; edit the short code (1–10 characters) at the end.
      </p>
      <div className="border-input bg-background flex max-w-lg flex-wrap items-center rounded-lg border px-3 py-2 font-mono text-sm">
        <span className="text-muted-foreground break-all">{prefix}</span>
        <input
          type="text"
          value={tabletCode}
          onChange={(e) =>
            onCodeChange(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10))
          }
          className="text-foreground min-w-[4rem] flex-1 border-0 bg-transparent font-semibold outline-none"
          aria-label="Tablet link code"
        />
      </div>
      {validation ? (
        <p className="text-destructive text-xs">{validation}</p>
      ) : fullLink ? (
        <p className="text-muted-foreground break-all font-mono text-xs">{fullLink}</p>
      ) : null}
      {fullLink ? (
        <img
          src={qrCodeUrl(fullLink, 128)}
          alt="Tablet QR code"
          width={128}
          height={128}
          className="border-border/80 rounded-lg border"
        />
      ) : null}
    </div>
  )
}
