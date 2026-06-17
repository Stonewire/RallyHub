import { Outlet } from 'react-router-dom'

import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner'
import { MustChangePasswordGuard } from '@/components/auth/MustChangePasswordGuard'

/** Root layout: all routes render here so global UI (cookie banner) has router context. */
export function AppRootLayout() {
  return (
    <MustChangePasswordGuard>
      <Outlet />
      <CookieConsentBanner />
    </MustChangePasswordGuard>
  )
}
