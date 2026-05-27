/** Live panel paths that must never require authentication. */
const PUBLIC_LIVE_PATTERNS = [
  /^\/facilitator\/[^/]+$/,
  /^\/display\/[^/]+$/,
  /^\/join\/[^/]+$/,
  /^\/tablet\/?$/,
] as const

export function isPublicLivePath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  return PUBLIC_LIVE_PATTERNS.some((re) => re.test(path))
}

/** Subdomains reserved for app routes — not organization tenants. */
export const RESERVED_TENANT_SUBDOMAINS = new Set([
  'join',
  'tablet',
  'display',
  'facilitator',
  'www',
  'admin',
  'api',
])
