import { supabase } from '@/lib/supabase'

/** True when the login field should be treated as an email address. */
export function looksLikeEmail(identifier: string): boolean {
  return identifier.trim().includes('@')
}

/**
 * Resolve a login identifier to the auth email Supabase expects.
 * Email-shaped input is lowercased; usernames are looked up via RPC.
 */
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim()
  if (!trimmed) return null

  if (looksLikeEmail(trimmed)) {
    return trimmed.toLowerCase()
  }

  const { data, error } = await supabase.rpc('resolve_login_email', {
    p_identifier: trimmed,
  })
  if (error) throw error
  if (!data || typeof data !== 'string') return null
  return data.toLowerCase()
}

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
