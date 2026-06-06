/** Whether the current route is the neo-minimalism pilot (RallyHub Dashboard). */
export function isRallyHubNeoPilotPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/'
  return normalized === '/admin'
}
