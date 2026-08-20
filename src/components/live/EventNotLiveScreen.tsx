import { useTranslation } from 'react-i18next'

import { BrandBackground } from '@/components/live/BrandBackground'
import { displayTextClass, logoForEvent } from '@/lib/live-event'
import type { TenantPublicOrg } from '@/lib/tenant'
import type { Tables } from '@/types/helpers'

type EventNotLiveScreenProps = {
  event: Tables<'events'>
  organization: TenantPublicOrg | Tables<'organizations'> | null
}

export function EventNotLiveScreen({ event, organization }: EventNotLiveScreenProps) {
  const { t } = useTranslation('live')
  const logo = logoForEvent(event, organization)
  const textClass = displayTextClass(event)
  const ended = event.status === 'archived'

  return (
    <BrandBackground event={event} organization={organization}>
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        {logo ? (
          <img src={logo} alt="" className="mb-8 max-h-24 object-contain" />
        ) : null}
        <h1 className={`font-sans text-3xl font-bold md:text-4xl ${textClass}`}>
          {event.name}
        </h1>
        <p className={`mt-8 font-sans text-2xl font-bold md:text-3xl ${textClass}`}>
          {ended ? t('notLive.ended') : t('notLive.startingSoon')}
        </p>
        <p className={`mt-4 max-w-md text-base opacity-90 md:text-lg ${textClass}`}>
          {ended ? t('notLive.endedBody') : t('notLive.startingBody')}
        </p>
      </div>
    </BrandBackground>
  )
}
