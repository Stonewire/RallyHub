import { approvedBingoCellIndices, hasBingoLine } from '@/lib/bingo-lines'

export const BINGO_CLAIM_MARK = 'claim'

export type BingoClaimStatus = {
  teamId: string
  teamName: string
  valid: boolean
}

export function teamHasBingoClaim(
  submissions: {
    team_id: string
    media_type: string | null
    media_url: string | null
    game_id: string
  }[],
  gameId: string,
  teamId: string,
): boolean {
  return submissions.some(
    (s) =>
      s.team_id === teamId &&
      s.media_type === 'bingo' &&
      s.game_id === gameId &&
      s.media_url === BINGO_CLAIM_MARK,
  )
}

export function evaluateBingoClaims(params: {
  submissions: {
    team_id: string
    media_type: string | null
    media_url: string | null
    status: string
    game_id: string
  }[]
  gameId: string
  teamNames: Map<string, string>
}): BingoClaimStatus[] {
  const { submissions, gameId, teamNames } = params
  const claimTeamIds = new Set(
    submissions
      .filter(
        (s) =>
          s.media_type === 'bingo' &&
          s.game_id === gameId &&
          s.media_url === BINGO_CLAIM_MARK,
      )
      .map((s) => s.team_id),
  )

  return [...claimTeamIds].map((teamId) => {
    const approved = approvedBingoCellIndices(
      submissions.filter((s) => s.team_id === teamId),
      gameId,
    )
    return {
      teamId,
      teamName: teamNames.get(teamId) ?? 'Team',
      valid: hasBingoLine(approved),
    }
  })
}
