import { useEffect } from 'react'

import { useOrganization } from '@/hooks/use-organization-settings'
import { useOrganizationId } from '@/hooks/use-organization-id'
import { setAppLanguage } from '@/lib/i18n'

/**
 * The admin panel follows the organisation's default language, the one the
 * client picks in Settings. Live surfaces follow their own event's language
 * instead, so this only ever drives the admin shell.
 *
 * The RallyHub platform panel (super admin) deliberately does not use this:
 * staff screens stay English whatever the client they are looking at.
 */
export function useAdminLanguage(): void {
  const organizationId = useOrganizationId()
  const { data: org } = useOrganization(organizationId)
  const language = org?.default_language

  useEffect(() => {
    if (language) void setAppLanguage(language)
  }, [language])
}
