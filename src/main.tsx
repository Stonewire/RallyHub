import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App.tsx'
import { AuthProvider } from '@/contexts/auth-context'
import { NotificationProvider } from '@/contexts/notification-context'
import { ThemeProvider } from '@/contexts/theme-context'
import { queryClient } from '@/lib/query-client'
import { registerServiceWorker } from '@/lib/register-service-worker'
import { TooltipProvider } from '@/components/ui/tooltip'

import './index.css'

registerServiceWorker()

// Camera stand-in for testing capture flows without a phone.
//
// Two locks, because this is code that fabricates camera input. The build-time
// flag is statically replaced, so a normal production build drops the import
// and never emits the chunk at all; to exercise a production build locally,
// run `VITE_CAPTURE_HARNESS=1 npm run build && npm run preview`. The harness
// then refuses to arm on anything but localhost whatever the query string says.
if (import.meta.env.DEV || import.meta.env.VITE_CAPTURE_HARNESS === '1') {
  void import('@/lib/dev-capture-harness').then(
    ({ captureHarnessRequest, installCaptureHarness }) => {
      const request = captureHarnessRequest()
      if (request) void installCaptureHarness(request)
    },
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <TooltipProvider>
              <App />
            </TooltipProvider>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
