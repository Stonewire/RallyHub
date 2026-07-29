export const queryKeys = {
  profile: ['profile'] as const,
  organization: (id: string | null) => ['organization', id] as const,
  organizationDeletionRequest: (id: string | null) =>
    ['organization-deletion-request', id] as const,
  organizationMembers: (id: string | null) =>
    ['organization-members', id] as const,
  dashboardStats: (orgId: string | null) => ['dashboard-stats', orgId] as const,
  recentEvents: (orgId: string | null) => ['recent-events', orgId] as const,
  activitySeries: (orgId: string | null, metric: string) =>
    ['activity-series', orgId, metric] as const,
  gameTypeBreakdown: (orgId: string | null) =>
    ['game-type-breakdown', orgId] as const,
  globalSearch: (orgId: string | null, query: string) =>
    ['global-search', orgId, query] as const,
  games: (orgId: string | null) => ['games', orgId] as const,
  platformLibraryGames: () => ['platform-library-games'] as const,
  platformLibraryOrg: () => ['platform-library-org'] as const,
  game: (gameId: string | undefined) => ['game', gameId] as const,
  gameGroups: (orgId: string | null) => ['game-groups', orgId] as const,
  trashedGames: (orgId: string | null) => ['trashed-games', orgId] as const,
  events: (orgId: string | null) => ['events', orgId] as const,
  trashedEvents: (orgId: string | null) => ['trashed-events', orgId] as const,
  event: (eventId: string) => ['event', eventId] as const,
  eventGames: (eventId: string) => ['event-games', eventId] as const,
  organizationInvoices: (orgId: string | null) =>
    ['organization-invoices', orgId] as const,
  musicCatalog: (orgId: string | null) => ['music-catalog', orgId] as const,
  inventoryItems: (orgId: string | null) => ['inventory-items', orgId] as const,
  inventoryPurchases: (eventId: string | undefined) =>
    ['inventory-purchases', eventId] as const,
  bingoRun: (eventId: string, stageIndex: number) =>
    ['bingo-run', eventId, stageIndex] as const,
  organizationFacilitators: (orgId: string | null) =>
    ['organization-facilitators', orgId] as const,
  organizationUsers: (orgId: string | null) => ['organization-users', orgId] as const,
  eventActivityLog: (eventId: string | undefined) => ['event-activity-log', eventId] as const,
}
