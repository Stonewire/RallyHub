import type * as React from 'react'
import { Outlet } from 'react-router-dom'

import { AppLegalFooter } from '@/components/legal/AppLegalFooter'
import { RallyHubAppSidebar } from '@/components/rallyhub/RallyHubAppSidebar'
import { RallyHubHeader } from '@/components/rallyhub/RallyHubHeader'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { cn } from '@/lib/utils'

export function RallyHubLayout() {
  useDocumentTitle('Admin')
  return (
    <SidebarProvider
      className="neo-minimal-scope"
      // Same widths as the client shell, set inline because SidebarProvider
      // writes these as inline styles a stylesheet cannot override.
      style={
        {
          '--sidebar-width': '168px',
          '--sidebar-width-icon': '64px',
        } as React.CSSProperties
      }
    >
      <RallyHubAppSidebar />
      <SidebarInset
        className={cn(
          'admin-shell-inset neo-minimal-inset bg-background relative flex max-h-[100dvh] min-h-svh flex-1 flex-col overflow-hidden lg:rounded-r-none',
        )}
      >
        {/* The client admin header with the platform's verbs. */}
        <RallyHubHeader />
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
