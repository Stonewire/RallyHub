/**
 * The legal documents an organisation's staff must accept, and their versions.
 *
 * Bump a version when the document changes materially. Everyone who accepted an
 * older version is then asked again on their next login — which is the whole point
 * of storing the version alongside the acceptance rather than a bare boolean.
 */
export const LEGAL_DOCUMENTS = [
  { key: 'terms', version: 1, label: 'Terms of Service', path: '/terms' },
  { key: 'privacy', version: 1, label: 'Privacy Policy', path: '/privacy' },
  { key: 'dpa', version: 1, label: 'Data Processing Agreement', path: '/dpa' },
] as const

export type LegalDocumentKey = (typeof LEGAL_DOCUMENTS)[number]['key']

export type LegalAcceptanceRow = {
  document: string
  version: number
}

/**
 * Which documents this user still owes us an acceptance for — either they have
 * never accepted it, or they accepted an older version than the one now in force.
 */
export function outstandingLegalDocuments(
  accepted: LegalAcceptanceRow[] | undefined | null,
): typeof LEGAL_DOCUMENTS[number][] {
  const rows = accepted ?? []
  return LEGAL_DOCUMENTS.filter((doc) => {
    const match = rows.find((r) => r.document === doc.key)
    return !match || match.version < doc.version
  })
}

export function hasAcceptedAllLegalDocuments(
  accepted: LegalAcceptanceRow[] | undefined | null,
): boolean {
  return outstandingLegalDocuments(accepted).length === 0
}

/**
 * Participant-facing privacy notice shown on the join screen. Participants are
 * anonymous (no account), so this is versioned separately and acknowledged
 * per-device rather than stored against a user id.
 */
export const PARTICIPANT_NOTICE_VERSION = 1
export const PARTICIPANT_NOTICE_STORAGE_KEY = 'rallyhub-participant-notice'

function participantNoticeKey(eventId: string) {
  return `${PARTICIPANT_NOTICE_STORAGE_KEY}:${eventId}`
}

/** Has this device already acknowledged the notice for this event? */
export function hasAcknowledgedParticipantNotice(eventId: string): boolean {
  try {
    return (
      window.localStorage.getItem(participantNoticeKey(eventId)) ===
      String(PARTICIPANT_NOTICE_VERSION)
    )
  } catch {
    // Private browsing / storage blocked. Show the notice rather than assume
    // consent — the wrong failure mode here is silently skipping it.
    return false
  }
}

export function acknowledgeParticipantNotice(eventId: string): void {
  try {
    window.localStorage.setItem(participantNoticeKey(eventId), String(PARTICIPANT_NOTICE_VERSION))
  } catch {
    // Nothing to do — they will simply be asked again. Better than blocking them
    // out of an event that is happening right now.
  }
}
