import type { Tables } from '@/types/helpers'

/**
 * What a facilitator's chat messages are signed with.
 *
 * Teams are talking to "the facilitator", not to whichever staff member picked
 * up the console, and a real name told a team nothing useful. This is also the
 * value the unread logic compares against, so it has to be one shared constant:
 * sign messages with one string and classify with another and the facilitator's
 * own replies come back as unread messages from a team.
 */
export const FACILITATOR_CHAT_SENDER = 'Facilitator'

function normalizeSender(sender: string | null | undefined): string {
  return (sender ?? '').trim().toLowerCase()
}

/** Team → facilitator message in a team thread (not sent by the facilitator). */
export function isTeamToFacilitatorChatMessage(
  message: Tables<'chat_messages'>,
  facilitatorName: string,
): boolean {
  if (!message.team_id) return false
  const sender = normalizeSender(message.sender)
  const facilitator = normalizeSender(facilitatorName)
  return Boolean(sender && facilitator && sender !== facilitator)
}

/** Facilitator → team message in this team's thread (not sent by the team). */
export function isFacilitatorToTeamChatMessage(
  message: Tables<'chat_messages'>,
  teamId: string,
  teamSenderName: string,
): boolean {
  return explainFacilitatorToTeamChatMessage(message, teamId, teamSenderName).isIncoming
}

/** Classification with the reason attached; isFacilitatorToTeamChatMessage wraps this. */
export function explainFacilitatorToTeamChatMessage(
  message: Tables<'chat_messages'>,
  teamId: string,
  teamSenderName: string,
): { isIncoming: boolean; reason: string } {
  if (message.team_id !== teamId) {
    return {
      isIncoming: false,
      reason: `team_id mismatch (message.team_id=${message.team_id ?? 'null'}, expected ${teamId})`,
    }
  }
  const sender = normalizeSender(message.sender)
  const team = normalizeSender(teamSenderName)
  if (!sender) {
    return { isIncoming: false, reason: 'sender is empty after trim' }
  }
  if (!team) {
    return { isIncoming: false, reason: 'teamSenderName is empty after trim' }
  }
  if (sender === team) {
    return {
      isIncoming: false,
      reason: `sender matches team name (both normalize to "${sender}") — team's own message`,
    }
  }
  return {
    isIncoming: true,
    reason: `facilitator message in team thread (sender="${message.sender}", team="${teamSenderName}")`,
  }
}
