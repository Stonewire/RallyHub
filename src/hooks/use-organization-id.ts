import { useAuth } from '@/contexts/auth-context'

export function useOrganizationId(): string | null {
  const { profile } = useAuth()
  return profile?.organization_id ?? null
}
