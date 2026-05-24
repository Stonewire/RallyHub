/** Whether `pathname` should mark a sidebar link as active. */
export function isAdminNavActive(
  pathname: string,
  to: string,
  end: boolean,
): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/'
  const target = to.replace(/\/$/, '') || '/'
  if (end) return normalized === target
  return normalized === target || normalized.startsWith(`${target}/`)
}
