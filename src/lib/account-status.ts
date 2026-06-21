/** A suspended org can sign in but cannot create new events or games. */
export function isOrgSuspended(status: string | null | undefined): boolean {
  return (status ?? '').toLowerCase() === 'suspended'
}
