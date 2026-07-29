import type * as React from 'react'
import { Outlet } from 'react-router-dom'

import { AdminAppSidebar } from '@/components/admin/AdminAppSidebar'
import { OnboardingChecklist } from '@/components/admin/OnboardingChecklist'
import { AppLegalFooter } from '@/components/legal/AppLegalFooter'
import { AdminHeader } from '@/components/shell/AdminHeader'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { cn } from '@/lib/utils'

export function AdminLayout() {
  useDocumentTitle('Admin')
  return (
    <SidebarProvider
      className="neo-minimal-scope"
      // SidebarProvider sets these as inline styles, so a stylesheet rule
      // cannot override them. The new design wants 168px / 64px.
      style={
        {
          '--sidebar-width': '168px',
          '--sidebar-width-icon': '64px',
        } as React.CSSProperties
      }
    >
      <AdminAppSidebar />
      <SidebarInset
        className={cn(
          'admin-shell-inset neo-minimal-inset bg-background relative flex max-h-[100dvh] min-h-svh flex-1 flex-col overflow-hidden lg:rounded-r-none',
        )}
      >
        {/* The sidebar collapse control lives in the header now. */}
        <AdminHeader />
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
