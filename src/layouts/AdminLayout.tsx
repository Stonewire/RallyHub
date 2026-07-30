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
      <a
        href="#admin-main"
        className="bg-primary text-primary-foreground focus:top-2 fixed -top-20 left-2 z-[100] rounded-md px-3 py-2 text-sm font-semibold shadow-lg transition-[top]"
      >
        Skip to main content
      </a>
      <AdminAppSidebar />
      <SidebarInset
        className={cn(
          'admin-shell-inset neo-minimal-inset bg-background relative flex max-h-[100dvh] min-h-svh flex-1 flex-col overflow-hidden lg:rounded-r-none',
        )}
      >
        {/* The sidebar collapse control lives in the header now. */}
        <AdminHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <main id="admin-main" className="flex-1" tabIndex={-1}>
            <Outlet />
          </main>
          <AppLegalFooter />
        </div>
      </SidebarInset>
      <OnboardingChecklist />
    </SidebarProvider>
  )
}
