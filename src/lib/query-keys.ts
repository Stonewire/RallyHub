export const queryKeys = {
  profile: ['profile'] as const,
  organization: (id: string | null) => ['organization', id] as const,
  organizationMembers: (id: string | null) =>
    ['organization-members', id] as const,
  dashboardStats: (orgId: string | null) => ['dashboard-stats', orgId] as const,
  recentEvents: (orgId: string | null) => ['recent-events', orgId] as const,
  games: (orgId: string | null) => ['games', orgId] as const,
  gameGroups: (orgId: string | null) => ['game-groups', orgId] as const,
  events: (orgId: string | null) => ['events', orgId] as const,
  event: (eventId: string) => ['event', eventId] as const,
  eventGames: (eventId: string) => ['event-games', eventId] as const,
  musicCatalog: (orgId: string | null) => ['music-catalog', orgId] as const,
  bingoRun: (eventId: string, stageIndex: number) =>
    ['bingo-run', eventId, stageIndex] as const,
}
