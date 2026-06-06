export const queryKeys = {
  profile: ['profile'] as const,
  organization: (id: string | null) => ['organization', id] as const,
  organizationMembers: (id: string | null) =>
    ['organization-members', id] as const,
  dashboardStats: (orgId: string | null) => ['dashboard-stats', orgId] as const,
  recentEvents: (orgId: string | null) => ['recent-events', orgId] as const,
  games: (orgId: string | null) => ['games', orgId] as const,
  platformLibraryGames: () => ['platform-library-games'] as const,
  platformLibraryOrg: () => ['platform-library-org'] as const,
  game: (gameId: string | undefined) => ['game', gameId] as const,
  gameGroups: (orgId: string | null) => ['game-groups', orgId] as const,
  events: (orgId: string | null) => ['events', orgId] as const,
  event: (eventId: string) => ['event', eventId] as const,
  eventGames: (eventId: string) => ['event-games', eventId] as const,
  organizationInvoices: (orgId: string | null) =>
    ['organization-invoices', orgId] as const,
  musicCatalog: (orgId: string | null) => ['music-catalog', orgId] as const,
  bingoRun: (eventId: string, stageIndex: number) =>
    ['bingo-run', eventId, stageIndex] as const,
}
