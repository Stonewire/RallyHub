import type { Tables } from '@/types/helpers'

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

/** Diagnostic breakdown for [msg-sound] logging on the team device. */
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
