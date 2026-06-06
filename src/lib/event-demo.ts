import type { Tables } from '@/types/helpers'

export const DEMO_MAX_TEAMS = 2

export const DEMO_OVERLAY_VISIBLE_MS = 2_000
export const DEMO_OVERLAY_CYCLE_MS = 20_000

export function isEventDemoStatus(status: string | null | undefined): boolean {
  return status === 'demo'
}

export function maxTeamCountForEventStatus(status: string | null | undefined): number {
  return isEventDemoStatus(status) ? DEMO_MAX_TEAMS : 20
}

export function capTeamCountForEventStatus(
  teamCount: number,
  status: string | null | undefined,
): number {
  const max = maxTeamCountForEventStatus(status)
  return Math.max(1, Math.min(max, teamCount))
}

export function demoTeamSlots<T extends { slot_number: number }>(teams: T[]): T[] {
  return teams.filter((team) => team.slot_number <= DEMO_MAX_TEAMS)
}

export function countClaimedTeams(teams: Pick<Tables<'teams'>, 'name'>[]): number {
  return teams.filter((team) => Boolean(team.name?.trim())).length
}
