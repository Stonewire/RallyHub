import { Outlet } from 'react-router-dom'

import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner'

/** Root layout: all routes render here so global UI (cookie banner) has router context. */
export function AppRootLayout() {
  return (
    <>
      <Outlet />
      <CookieConsentBanner />
    </>
  )
}
