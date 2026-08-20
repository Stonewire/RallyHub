import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

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

function stepsFor(
  t: TFunction<'common'>,
  context: InstallGuideContext,
): { platform: string; steps: string[] }[] {
  const isTablet = context === 'tablet'
  const target = isTablet ? t('install.guide.openedTablet') : t('install.guide.openedApp')
  const pin = isTablet ? [t('install.guide.pinStep')] : []
  const result = isTablet ? t('install.guide.resultTablet') : t('install.guide.resultApp')

  return [
    {
      platform: t('install.guide.android.platform'),
      steps: [
        t('install.guide.android.open', { target }),
        ...pin,
        t('install.guide.android.menu'),
        t('install.guide.android.add'),
        result,
      ],
    },
    {
      platform: t('install.guide.ios.platform'),
      steps: [
        t('install.guide.ios.open', { target }),
        ...pin,
        t('install.guide.ios.share'),
        t('install.guide.ios.add'),
        result,
      ],
    },
    {
      platform: t('install.guide.mac.platform'),
      steps: [
        t('install.guide.mac.open', { target }),
        ...pin,
        t('install.guide.mac.addToDock'),
        t('install.guide.mac.result'),
      ],
    },
    {
      platform: t('install.guide.desktop.platform'),
      steps: [
        t('install.guide.desktop.open', { target }),
        ...pin,
        t('install.guide.desktop.addressBar'),
        t('install.guide.desktop.menuFallback'),
        t('install.guide.desktop.result'),
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
  const { t } = useTranslation('common')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {/* text-left explicitly: the modal is rendered inside whatever called it,
          and the facilitator landing card centres its contents, which turned the
          numbered steps into a squashed column. */}
      <Card className="border-border/80 max-h-[85vh] w-full max-w-lg overflow-auto bg-card p-6 text-left shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-lg font-semibold">{t('install.guide.title')}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {context === 'tablet' ? t('install.guide.introTablet') : t('install.guide.introApp')}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('close')}
            onClick={onClose}
          >
            <IconClose className="size-4" />
          </Button>
        </div>

        <div className="space-y-5">
          {stepsFor(t, context).map(({ platform, steps }) => (
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
            {t('install.guide.gotIt')}
          </NeoButton>
        </div>
      </Card>
    </div>
  )
}
