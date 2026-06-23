import { Label } from '@/components/ui/label'
import { getTabletLink } from '@/lib/tablet-link'
import { qrCodeUrl } from '@/lib/event-links'

type TabletLinkEditorProps = {
  subdomain: string
}

export function TabletLinkEditor({ subdomain }: TabletLinkEditorProps) {
  const fullLink = getTabletLink({ subdomain })

  return (
    <div className="space-y-3">
      <Label>Tablet link</Label>
      <p className="text-muted-foreground text-xs">
        Shared kiosk URL for your organization: <span className="font-mono">/{subdomain}/tablet</span>.
        The <span className="font-mono">{subdomain}</span> part is your client URL slug — changing it
        (in your client settings) regenerates this link and its QR code.
      </p>
      <div className="border-input bg-background max-w-lg break-all rounded-lg border px-3 py-2 font-mono text-sm">
        {fullLink}
      </div>
      <img
        src={qrCodeUrl(fullLink, 128)}
        alt="Tablet QR code"
        width={128}
        height={128}
        className="border-border/80 rounded-lg border"
      />
    </div>
  )
}
