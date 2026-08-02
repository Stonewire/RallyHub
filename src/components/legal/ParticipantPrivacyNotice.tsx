import { useState } from 'react'

import { useCookieConsent } from '@/contexts/cookie-consent-context'
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
  const [showFull, setShowFull] = useState(false)
  const { rejectNonEssential } = useCookieConsent()

  const host = organizationName?.trim() || 'The event organiser'

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
            Before you join
          </h2>
          <p className="text-sm leading-relaxed text-black/70">
            {host} is running this event and decides what you are asked to do. RallyHub provides
            the platform.
          </p>
        </div>

        <div className="space-y-2 rounded-xl bg-black/[0.06] p-3.5">
          <p className="text-sm font-bold">
            What gets collected
          </p>
          <ul className="space-y-1 text-sm text-black/70">
            <li>• The team name and player name you type in.</li>
            <li>
              •{' '}
              <span className="font-bold text-black">
                Any photos or videos you submit
              </span>{' '}
              during challenges. These may show you and other people.
            </li>
            <li>• Your answers and your team&apos;s score.</li>
          </ul>
          <p className="text-sm text-black/70">
            {host} can see everything your team submits. RallyHub stores it on their behalf and
            deletes it when they delete the event.
          </p>
        </div>

        {/* The cookie half of what used to be a second banner. Essential only,
            so it is a statement rather than a question. */}
        <p className="text-xs leading-relaxed text-black/55">
          This app keeps a little data on your phone so it remembers your team. No analytics, no
          tracking, no optional cookies.{' '}
          <a
            href="/cookies"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Cookie Policy
          </a>
          .
        </p>

        {showFull ? (
          <div
            className="space-y-2 text-xs leading-relaxed text-black/55"
          >
            <p>
              You do not have to take part. If you would rather not be photographed or filmed, tell
              the organiser. They can run the event without you, or give you a role that does not
              involve submitting media.
            </p>
            <p>
              To ask what is held about you, or to have it deleted, contact the event organiser
              first, as they decide what happens to it. You can also read the full{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                RallyHub Privacy Policy
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
            Read more
          </button>
        )}

        {/* One press, and it says what it is agreeing to. The tick box in front
            of it was a second tap for the same decision. */}
        <button
          type="button"
          onClick={handleAccept}
          className="xp-card w-full bg-nm-yellow px-4 py-3 text-sm font-black text-black"
        >
          I have read this, take me in
        </button>
      </div>
    </div>
  )
}
