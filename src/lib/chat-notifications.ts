import type { Tables } from '@/types/helpers'

/** Team → facilitator message in a team thread (not sent by the facilitator). */
export function isTeamToFacilitatorChatMessage(
  message: Tables<'chat_messages'>,
  facilitatorName: string,
): boolean {
  if (!message.team_id) return false
  const sender = (message.sender ?? '').trim()
  const facilitator = facilitatorName.trim()
  return Boolean(sender && facilitator && sender !== facilitator)
}

/** Facilitator → team message in this team's thread (not sent by the team). */
export function isFacilitatorToTeamChatMessage(
  message: Tables<'chat_messages'>,
  teamId: string,
  teamSenderName: string,
): boolean {
  if (message.team_id !== teamId) return false
  const sender = (message.sender ?? '').trim()
  const teamName = teamSenderName.trim()
  return Boolean(sender && teamName && sender !== teamName)
}
