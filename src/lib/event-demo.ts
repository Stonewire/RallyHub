import type { Tables } from '@/types/helpers'

/**
 * Demo events keep the full configured team list and every slot row (P4.1).
 * The only demo limitation is that at most this many teams may be CLAIMED at
 * a time, enforced client-side on the join and facilitator surfaces and
 * server-side in claim_team_with_inventory_access.
 */
export const DEMO_MAX_TEAMS = 2

export const DEMO_OVERLAY_VISIBLE_MS = 2_000
export const DEMO_OVERLAY_CYCLE_MS = 20_000

/** Hard ceiling on configured teams per event, matching syncTeamSlots. */
export const MAX_TEAM_COUNT = 20

export function isEventDemoStatus(status: string | null | undefined): boolean {
  return status === 'demo'
}

/** Clamp a configured team count to 1..MAX_TEAM_COUNT (status-independent). */
export function clampTeamCount(teamCount: number): number {
  return Math.max(1, Math.min(MAX_TEAM_COUNT, teamCount))
}

export function countClaimedTeams(teams: Pick<Tables<'teams'>, 'name'>[]): number {
  return teams.filter((team) => Boolean(team.name?.trim())).length
}
