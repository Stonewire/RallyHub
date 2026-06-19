/** A suspended org can sign in but cannot create new events or games. */
export function isOrgSuspended(status: string | null | undefined): boolean {
  return (status ?? '').toLowerCase() === 'suspended'
}

/** A trial org gets its first activated event free. */
export function isOrgTrial(status: string | null | undefined): boolean {
  return (status ?? '').toLowerCase() === 'trial'
}
