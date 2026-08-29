import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCookieConsent } from '@/contexts/cookie-consent-context'
import { usePlatformBrand } from '@/hooks/use-platform-brand'
import { acknowledgeParticipantNotice } from '@/lib/legal-acceptance'

/**
 * Shown to a participant before they can join an event.
 *
 * Participants are anonymous — they have no account — so this is acknowledged per
 * device rather than stored against a user id. Under GDPR the ORGANISER is the
 * controller here (they chose to run the event and set the challenges); this notice
 * is RallyHub being transparent with the person actually standing in the room, and
 * giving them a real chance to walk away before they are photographed.
 *
 * Deliberately blunt about the photo/video part, because that is the bit people
 * would object to if they only found out afterwards.
 *
 * It also carries the storage line, so a player scanning a code meets one card
 * rather than a cookie banner stacked on a consent card. That merge is only
 * honest because the app sets nothing but essential storage: there is no
 * optional cookie here for a single button to quietly opt anyone into.
 */
export function ParticipantPrivacyNotice({
  eventId,
  organizationName,
  onAccept,
}: {
  eventId: string
  organizationName?: string | null
  onAccept: () => void
}) {
  const { t } = useTranslation('live')
  const [showFull, setShowFull] = useState(false)
  const { rejectNonEssential } = useCookieConsent()

  const host = organizationName?.trim() || t('join.consent.defaultHost')
  // A white-labelled event's players have never heard of us, so the two lines
  // that name the platform carry the organiser's brand instead.
  const brand = usePlatformBrand()

  function handleAccept() {
    acknowledgeParticipantNotice(eventId)
    // Essential storage only — the same decision the banner's one button makes.
    rejectNonEssential()
    onAccept()
  }

  return (
    <div className="experience-scope fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm">
      <div className="xp-card my-auto w-full max-w-md space-y-4 bg-white p-6 text-black">
        <div className="space-y-2">
          <h2 className="text-xl font-black">
            {t('join.consent.title')}
          </h2>
          <p className="text-sm leading-relaxed text-black/70">
            {t('join.consent.intro', { host, brand })}
          </p>
        </div>

        <div className="space-y-2 rounded-xl bg-black/[0.06] p-3.5">
          <p className="text-sm font-bold">
            {t('join.consent.whatCollectedTitle')}
          </p>
          <ul className="space-y-1 text-sm text-black/70">
            <li>• {t('join.consent.collectTeamName')}</li>
            <li>
              •{' '}
              <span className="font-bold text-black">
                {t('join.consent.collectMediaBold')}
              </span>{' '}
              {t('join.consent.collectMediaRest')}
            </li>
            <li>• {t('join.consent.collectScore')}</li>
          </ul>
          <p className="text-sm text-black/70">
            {t('join.consent.hostSeesEverything', { host, brand })}
          </p>
        </div>

        {/* The cookie half of what used to be a second banner. Essential only,
            so it is a statement rather than a question. */}
        <p className="text-xs leading-relaxed text-black/55">
          {t('join.consent.cookieNote')}{' '}
          <a
            href="/cookies"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {t('join.consent.cookiePolicyLink')}
          </a>
          .
        </p>

        {showFull ? (
          <div
            className="space-y-2 text-xs leading-relaxed text-black/55"
          >
            <p>
              {t('join.consent.notForced')}
            </p>
            <p>
              {t('join.consent.dataRequest')}{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {t('join.consent.privacyPolicyLink')}
              </a>
              .
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowFull(true)}
            className="text-sm font-bold underline underline-offset-2"
          >
            {t('join.consent.readMore')}
          </button>
        )}

        {/* One press, and it says what it is agreeing to. The tick box in front
            of it was a second tap for the same decision. */}
        <button
          type="button"
          onClick={handleAccept}
          className="xp-card w-full bg-nm-yellow px-4 py-3 text-sm font-black text-black"
        >
          {t('join.consent.acceptButton')}
        </button>
      </div>
    </div>
  )
}
