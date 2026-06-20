import { Outlet } from 'react-router-dom'

import { AdminAppSidebar } from '@/components/admin/AdminAppSidebar'
import { ThemeToggle } from '@/components/brand/ThemeToggle'
import { AppLegalFooter } from '@/components/legal/AppLegalFooter'
import { Separator } from '@/components/ui/separator'
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
          'admin-shell-inset neo-minimal-inset bg-background flex max-h-[100dvh] min-h-svh flex-1 overflow-hidden lg:rounded-r-none',
        )}
      >
        <header className="neo-topbar bg-background flex h-14 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
          <SidebarTrigger className="neo-topbar-trigger text-foreground [&_svg]:size-5" />
          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:bg-border h-5"
          />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
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
