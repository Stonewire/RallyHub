/** True when the login field should be treated as an email address. */
export function looksLikeEmail(identifier: string): boolean {
  return identifier.trim().includes('@')
}

// Username-to-email resolution used to live here as resolveLoginEmail (an anon
// RPC). It leaked the real email behind any username to any caller (audit
// AUD-4), so resolution + sign-in now happen server-side in the
// login-identifier edge function. See src/contexts/auth-context.tsx.

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
}

export function validateUsername(value: string): string | null {
  const normalized = normalizeUsername(value)
  if (normalized.length < 3) return 'Username must be at least 3 characters (letters, numbers, underscore).'
  if (normalized.length > 32) return 'Username must be at most 32 characters.'
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'Username may only contain letters, numbers, and underscores.'
  }
  return null
}
