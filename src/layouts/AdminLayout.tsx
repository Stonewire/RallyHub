import { Outlet } from 'react-router-dom'

import { AdminAppSidebar } from '@/components/admin/AdminAppSidebar'
import { OnboardingChecklist } from '@/components/admin/OnboardingChecklist'
import { AppLegalFooter } from '@/components/legal/AppLegalFooter'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export function AdminLayout() {
  return (
    <SidebarProvider className="neo-minimal-scope">
      <AdminAppSidebar />
      <SidebarInset
        className={cn(
          'admin-shell-inset neo-minimal-inset bg-background relative flex max-h-[100dvh] min-h-svh flex-1 overflow-hidden lg:rounded-r-none',
        )}
      >
        {/* Collapse toggle floats just outside the charcoal sidebar — charcoal
            on the light canvas, ivory on the dark canvas (text-foreground). */}
        <SidebarTrigger className="text-foreground absolute left-3 top-3 z-30 opacity-70 hover:opacity-100 [&_svg]:size-5" />
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div className="flex-1">
            <Outlet />
          </div>
          <AppLegalFooter />
        </div>
      </SidebarInset>
      <OnboardingChecklist />
    </SidebarProvider>
  )
}
