import { incrementTeamScore } from '@/lib/increment-team-score'

/** Add awarded points to team score when a submission is approved. */
export async function applySubmissionPoints(
  teamId: string,
  points: number,
  eventId?: string,
): Promise<void> {
  if (points <= 0) return
  await incrementTeamScore(teamId, points, eventId)
}
