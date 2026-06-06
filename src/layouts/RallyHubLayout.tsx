import { Outlet } from 'react-router-dom'

import { AppLegalFooter } from '@/components/legal/AppLegalFooter'
import { RallyHubAppSidebar } from '@/components/rallyhub/RallyHubAppSidebar'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
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
        <header className="neo-topbar bg-background flex h-14 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
          <SidebarTrigger className="neo-topbar-trigger text-[#3E3D3E] [&_svg]:size-5" />
          <Separator
            orientation="vertical"
            className="h-5 data-[orientation=vertical]:bg-[rgb(62_61_62/0.12)]"
          />
        </header>
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
