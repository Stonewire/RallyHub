import { useAuth } from '@/contexts/auth-context'
import { canAccessRallyHub } from '@/lib/auth-routes'
import { isPlatformHost } from '@/lib/tenant'

/** True on the SuperAdmin RallyHub admin panel (platform host + super admin). */
export function useRallyHubAdminUI(): boolean {
  const { role, profileLoading } = useAuth()
  if (profileLoading) return false
  return canAccessRallyHub(role) && isPlatformHost()
}
