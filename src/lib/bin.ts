export const BIN_RETENTION_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/** Days left before a trashed row auto-purges. Never negative. */
export function daysRemaining(deletedAt: string): number {
  const expiresAt = new Date(deletedAt).getTime() + BIN_RETENTION_DAYS * DAY_MS
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / DAY_MS))
}
