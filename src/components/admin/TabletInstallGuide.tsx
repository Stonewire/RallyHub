import { X } from 'lucide-react'

import { NeoButton } from '@/components/neo-minimal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const STEPS: { platform: string; steps: string[] }[] = [
  {
    platform: 'Android tablet or phone (Chrome)',
    steps: [
      'Open the tablet link in Chrome.',
      'Enter the 4-digit tablet password once.',
      'Tap the three dots in the top right.',
      'Tap "Add to Home screen", then "Add".',
      'The tablet now has a RallyHub icon that opens straight to the score screen.',
    ],
  },
  {
    platform: 'iPad or iPhone (Safari)',
    steps: [
      'Open the tablet link in Safari. This does not work in Chrome on iOS.',
      'Enter the 4-digit tablet password once.',
      'Tap the Share button, the square with the arrow.',
      'Scroll down and tap "Add to Home Screen", then "Add".',
      'The iPad now has a RallyHub icon that opens straight to the score screen.',
    ],
  },
]

/**
 * How to pin the tablet link to a device home screen.
 *
 * Written out here rather than linked to the PDF Rumen plans, so the guidance
 * exists now instead of being a button that goes nowhere. The PDF can replace
 * or supplement this later without moving the button.
 *
 * Caveat worth keeping in view: the app has no web manifest, so a pinned link
 * still opens inside the browser rather than as a standalone app. The steps
 * below are true and useful today; full standalone behaviour is a separate job
 * recorded in the work plan.
 */
export function TabletInstallGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="border-border/80 max-h-[85vh] w-full max-w-lg overflow-auto bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-lg font-semibold">
              Put the tablet link on a device
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Adds a RallyHub icon to the home screen so staff do not have to find
              the link each time.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-5">
          {STEPS.map(({ platform, steps }) => (
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
