/**
 * Prefixes an internal app path with the current client's slug, e.g.
 * orgPath('sharphawk', '/admin/events') -> '/sharphawk/admin/events'.
 * Returns the path unchanged when there is no slug in scope (the super-admin
 * panel on admin.rallyhub.games never has a clientSlug and stays unprefixed).
 */
export function orgPath(clientSlug: string | null | undefined, path: string): string {
  if (!clientSlug) return path
  const clean = path.startsWith('/') ? path : `/${path}`
  return `/${clientSlug}${clean}`
}
