import { useAuth } from '@/contexts/auth-context'
import {
  useIsPlatformGamesAdmin,
  usePlatformLibraryOrganizationId,
} from '@/hooks/use-platform-library'

export function useOrganizationId(): string | null {
  const { profile } = useAuth()
  return profile?.organization_id ?? null
}

/** Organization context for admin game CRUD (client org or platform library for super admin). */
export function useAdminOrganizationId(): string | null {
  const { profile } = useAuth()
  const isPlatform = useIsPlatformGamesAdmin()
  const platformOrg = usePlatformLibraryOrganizationId({ enabled: isPlatform })

  if (isPlatform) {
    return platformOrg.data ?? null
  }
  return profile?.organization_id ?? null
}

export function useAdminOrganizationLoading(): boolean {
  const isPlatform = useIsPlatformGamesAdmin()
  const platformOrg = usePlatformLibraryOrganizationId({ enabled: isPlatform })
  return isPlatform && platformOrg.isLoading
}
