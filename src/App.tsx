import { RouterProvider } from 'react-router-dom'

import { CookieConsentProvider } from '@/contexts/cookie-consent-context'
import { router } from '@/router'

export default function App() {
  return (
    <CookieConsentProvider>
      <RouterProvider router={router} />
    </CookieConsentProvider>
  )
}
