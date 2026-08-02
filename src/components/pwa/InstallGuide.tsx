import { IconClose } from '@/components/icons'

import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * How to pin RallyHub to a device home screen, Dock or desktop.
 *
 * Safari never offers to install a site, and Chromium only offers once per
 * session, so written steps are the fallback whenever the native prompt is not
 * available. Started as the tablet-only guide on Settings; the same steps work
 * for the admin panel and the facilitator console, so the two tablet-specific
 * lines are the only thing the context changes.
 */
export type InstallGuideContext = 'tablet' | 'app'

function stepsFor(context: InstallGuideContext): { platform: string; steps: string[] }[] {
  const isTablet = context === 'tablet'
  const opened = isTablet ? 'the tablet link' : 'RallyHub'
  const pin = isTablet ? ['Enter the 4-digit tablet password once.'] : []
  const result = isTablet
    ? 'The device now has a RallyHub icon that opens straight to the score screen.'
    : 'The device now has a RallyHub icon that opens in its own window, with no address bar.'

  return [
    {
      platform: 'Android tablet or phone (Chrome)',
      steps: [
        `Open ${opened} in Chrome.`,
        ...pin,
        'Tap the three dots in the top right.',
        'Tap "Add to Home screen", then "Install".',
        result,
      ],
    },
    {
      platform: 'iPad or iPhone (Safari)',
      steps: [
        `Open ${opened} in Safari. This does not work in Chrome on iOS.`,
        ...pin,
        'Tap the Share button, the square with the arrow.',
        'Scroll down and tap "Add to Home Screen", then "Add".',
        result,
      ],
    },
    {
      platform: 'Mac (Safari)',
      steps: [
        `Open ${opened} in Safari.`,
        ...pin,
        'Choose File, then "Add to Dock".',
        'RallyHub opens from the Dock in its own window.',
      ],
    },
    {
      platform: 'Windows or Mac (Chrome or Edge)',
      steps: [
        `Open ${opened} in Chrome or Edge.`,
        ...pin,
        'Click the install icon at the right-hand end of the address bar.',
        'If it is not there, open the three dots menu, then "Cast, save and share", then "Install page as app".',
        'RallyHub opens from the desktop or taskbar in its own window.',
      ],
    },
  ]
}

export function InstallGuide({
  onClose,
  context = 'app',
}: {
  onClose: () => void
  context?: InstallGuideContext
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {/* text-left explicitly: the modal is rendered inside whatever called it,
          and the facilitator landing card centres its contents, which turned the
          numbered steps into a squashed column. */}
      <Card className="border-border/80 max-h-[85vh] w-full max-w-lg overflow-auto bg-card p-6 text-left shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-lg font-semibold">
              Install RallyHub on your device
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {context === 'tablet'
                ? 'Adds a RallyHub icon to the home screen, Dock or desktop, so staff do not have to find the link each time. Chrome and Safari are the recommended browsers.'
                : 'Adds a RallyHub icon to the home screen, Dock or desktop, and opens it in its own window without the browser around it.'}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <IconClose className="size-4" />
          </Button>
        </div>

        <div className="space-y-5">
          {stepsFor(context).map(({ platform, steps }) => (
            <div key={platform}>
              <h3 className="text-foreground text-sm font-bold">{platform}</h3>
              <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-sm">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <NeoButton type="button" variant="primary" size="sm" onClick={onClose}>
            Got it
          </NeoButton>
        </div>
      </Card>
    </div>
  )
}
