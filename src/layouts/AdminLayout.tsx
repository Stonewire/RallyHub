import type * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

import { AdminAppSidebar } from '@/components/admin/AdminAppSidebar'
import { OnboardingChecklist } from '@/components/admin/OnboardingChecklist'
import { AppLegalFooter } from '@/components/legal/AppLegalFooter'
import { AdminHeader } from '@/components/shell/AdminHeader'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useAdminLanguage } from '@/hooks/use-admin-language'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { cn } from '@/lib/utils'
import { DemoSandboxBar } from '@/components/demo/DemoSandboxBar'

export function AdminLayout() {
  // The whole panel follows the org's default language, set in Settings.
  useAdminLanguage()
  const { t } = useTranslation('admin')
  useDocumentTitle(t('shell.documentTitle'))
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
        {t('shell.skipToMainContent')}
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
          <DemoSandboxBar />
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
