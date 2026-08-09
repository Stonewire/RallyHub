import { isFacilitatorOnlyRole } from '@/lib/auth-routes'
import { orgPath } from '@/lib/org-path'
import type { AppRole } from '@/types/database'

export type SearchKind = 'game' | 'event' | 'ticket'

export type SearchResult = {
  id: string
  kind: SearchKind
  label: string
  to: string
}

export type SearchInput = {
  games: { id: string; name: string }[]
  events: { id: string; name: string }[]
  tickets: { id: string; subject: string }[]
}

/**
 * Shapes raw rows into tagged, routable results. Facilitators only reach their
 * events surface, so games and tickets are withheld from them.
 */
export function buildSearchResults(
  input: SearchInput,
  role: AppRole | null,
  clientSlug: string | null,
): SearchResult[] {
  const facilitator = isFacilitatorOnlyRole(role)

  const games: SearchResult[] = facilitator
    ? []
    : input.games.map((game) => ({
        id: game.id,
        kind: 'game' as const,
        label: game.name,
        // A real route, so a search hit opens the game rather than dumping the
        // user on the library to find it again.
        to: orgPath(clientSlug, `/admin/games/${game.id}`),
      }))

  const events: SearchResult[] = input.events.map((event) => ({
    id: event.id,
    kind: 'event' as const,
    label: event.name,
    to: orgPath(clientSlug, `/admin/events/${event.id}`),
  }))

  const tickets: SearchResult[] = facilitator
    ? []
    : input.tickets.map((ticket) => ({
        id: ticket.id,
        kind: 'ticket' as const,
        label: ticket.subject,
        to: orgPath(clientSlug, `/admin/support?ticket=${ticket.id}`),
      }))

  return [...games, ...events, ...tickets]
}
