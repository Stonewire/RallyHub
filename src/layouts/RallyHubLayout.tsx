import { Outlet } from 'react-router-dom'

import { AppLegalFooter } from '@/components/legal/AppLegalFooter'
import { RallyHubAppSidebar } from '@/components/rallyhub/RallyHubAppSidebar'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export function RallyHubLayout() {
  return (
    <SidebarProvider className="neo-minimal-scope">
      <RallyHubAppSidebar />
      <SidebarInset
        className={cn(
          'admin-shell-inset neo-minimal-inset bg-background flex max-h-[100dvh] min-h-svh flex-1 overflow-hidden lg:rounded-r-none',
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div className="flex-1">
            <Outlet />
          </div>
          <AppLegalFooter />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
