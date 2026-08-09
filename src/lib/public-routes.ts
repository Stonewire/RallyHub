/** Live panel paths that must never require authentication. */
const PUBLIC_LIVE_PATTERNS = [
  // Legacy UUID-based routes (redirect shim keeps these resolvable forever).
  /^\/display\/[^/]+$/,
  /^\/join\/[^/]+$/,
  /^\/facilitator\/[^/]+$/,
  /^\/tablet\/?$/,
  /^\/tablet\/[^/]+\/[^/]+$/,
  // Legacy slug-based routes (/{client}/events/{event}/{surface}) — kept as
  // an alias, see Task 8.
  /^\/[^/]+\/events\/[^/]+\/(facilitator|display|teams)$/,
  // New primary slug-based routes: /{client}/{event}/{surface}. The client
  // and event slugs never collide with reserved words (Task 1's DB trigger
  // and this file's RESERVED_TENANT_SUBDOMAINS both block that), so a plain
  // 3-segment match is unambiguous. Only join accepts a trailing segment (team).
  /^\/[^/]+\/[^/]+\/(?:display|facilitator)$|^\/[^/]+\/[^/]+\/join(\/[^/]+)?$/,
] as const

export function isPublicLivePath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  return PUBLIC_LIVE_PATTERNS.some((re) => re.test(path))
}

/** Subdomains and first-path-segments reserved for app routes — never an
 *  organization's client slug. Mirrors the DB-level check in migration
 *  20260808120000 (organizations_validate_subdomain trigger); kept here too
 *  for client-side host/path resolution in tenant.ts. */
export const RESERVED_TENANT_SUBDOMAINS = new Set([
  'login',
  'register',
  'privacy',
  'terms',
  'dpa',
  'imprint',
  'cookies',
  'contact',
  'play',
  'tablet',
  'join',
  'display',
  'facilitator',
  'events',
  'app',
  'admin',
  'api',
  'assets',
  'www',
])
