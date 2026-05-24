import { Outlet } from 'react-router-dom'

import { AdminAppSidebar } from '@/components/admin/AdminAppSidebar'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

export function AdminLayout() {
  return (
    <SidebarProvider>
      <AdminAppSidebar />
      <SidebarInset className="admin-shell-inset bg-background flex max-h-[100dvh] min-h-svh flex-1 overflow-hidden lg:rounded-r-none">
        <header className="bg-background flex h-14 shrink-0 items-center gap-2 border-b border-[rgb(62_61_62/0.08)] px-4 lg:px-6">
          <SidebarTrigger className="text-[#3E3D3E] [&_svg]:size-5" />
          <Separator
            orientation="vertical"
            className="h-5 data-[orientation=vertical]:bg-[rgb(62_61_62/0.12)]"
          />
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
