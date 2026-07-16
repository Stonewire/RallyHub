export const CURRENT_PARTICIPANT_SESSION_KEY = 'rallyhub_current_participant_session'

export type CurrentParticipantSession = {
  eventId: string
  teamId: string
  purchaseToken?: string
  savedAt: string
}

export function saveCurrentParticipantSession(eventId: string, teamId: string, purchaseToken?: string) {
  const existing = getCurrentParticipantSession()
  const session: CurrentParticipantSession = {
    eventId,
    teamId,
    purchaseToken:
      purchaseToken ??
      (existing?.eventId === eventId && existing.teamId === teamId
        ? existing.purchaseToken
        : undefined),
    savedAt: new Date().toISOString(),
  }
  localStorage.setItem(CURRENT_PARTICIPANT_SESSION_KEY, JSON.stringify(session))
}

export function getCurrentParticipantSession(): CurrentParticipantSession | null {
  try {
    const value = localStorage.getItem(CURRENT_PARTICIPANT_SESSION_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<CurrentParticipantSession>
    if (!parsed.eventId || !parsed.teamId || !parsed.savedAt) return null
    return parsed as CurrentParticipantSession
  } catch {
    return null
  }
}

export function clearCurrentParticipantSession(eventId: string, teamId?: string) {
  const current = getCurrentParticipantSession()
  if (!current || current.eventId !== eventId) return
  if (teamId && current.teamId !== teamId) return
  localStorage.removeItem(CURRENT_PARTICIPANT_SESSION_KEY)
}
