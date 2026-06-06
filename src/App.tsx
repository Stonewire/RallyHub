import { RouterProvider } from 'react-router-dom'

import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner'
import { CookieConsentProvider } from '@/contexts/cookie-consent-context'
import { router } from '@/router'

export default function App() {
  return (
    <CookieConsentProvider>
      <RouterProvider router={router} />
      <CookieConsentBanner />
    </CookieConsentProvider>
  )
}
