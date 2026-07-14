import { useState } from 'react'

import { NeoButton } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
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
  const [checked, setChecked] = useState(false)
  const [showFull, setShowFull] = useState(false)

  const host = organizationName?.trim() || 'The event organiser'

  function handleAccept() {
    acknowledgeParticipantNotice(eventId)
    onAccept()
  }

  return (
    <div className="bg-background/95 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 backdrop-blur-sm">
      <Card className="border-border/80 w-full max-w-md space-y-4 p-6 shadow-lg">
        <div className="space-y-2">
          <h2 className="text-foreground text-lg font-semibold">Before you join</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {host} is running this event and decides what you are asked to do. RallyHub provides
            the platform.
          </p>
        </div>

        <div className="border-border/80 bg-muted/30 space-y-2 rounded-lg border p-3">
          <p className="text-foreground text-sm font-medium">What gets collected</p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>• The team name and player name you type in.</li>
            <li>
              • <span className="text-foreground">Any photos or videos you submit</span> during
              challenges. These may show you and other people.
            </li>
            <li>• Your answers and your team&apos;s score.</li>
          </ul>
          <p className="text-muted-foreground text-sm">
            {host} can see everything your team submits. RallyHub stores it on their behalf and
            deletes it when they delete the event.
          </p>
        </div>

        {showFull ? (
          <div className="text-muted-foreground space-y-2 text-xs leading-relaxed">
            <p>
              You do not have to take part. If you would rather not be photographed or filmed, tell
              the organiser — they can run the event without you, or give you a role that does not
              involve submitting media.
            </p>
            <p>
              To ask what is held about you, or to have it deleted, contact the event organiser
              first, as they decide what happens to it. You can also read the full{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline"
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
            className="text-foreground text-sm font-medium underline"
          >
            Read more
          </button>
        )}

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="accent-primary mt-0.5 size-4 shrink-0"
          />
          <span className="text-muted-foreground">
            I have read this and I am happy to take part.
          </span>
        </label>

        <NeoButton
          variant="accent"
          onClick={handleAccept}
          disabled={!checked}
          className="w-full"
        >
          Continue to the event
        </NeoButton>
      </Card>
    </div>
  )
}
