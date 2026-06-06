import { Building2, Calendar, CreditCard } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'

export type ClientDetailTab = 'info' | 'billing' | 'events'

const TABS: {
  id: ClientDetailTab
  label: string
  icon: typeof Building2
}[] = [
  { id: 'info', label: 'Client Info', icon: Building2 },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'events', label: 'Events', icon: Calendar },
]

type ClientDetailSidebarProps = {
  activeTab: ClientDetailTab
  onTabChange: (tab: ClientDetailTab) => void
  /** Hide billing and events tabs until the client exists. */
  showBillingAndEvents: boolean
}

export function ClientDetailSidebar({
  activeTab,
  onTabChange,
  showBillingAndEvents,
}: ClientDetailSidebarProps) {
  const visibleTabs = showBillingAndEvents
    ? TABS
    : TABS.filter((tab) => tab.id === 'info')

  return (
    <SidebarProvider defaultOpen>
      <Sidebar
        collapsible="none"
        className="admin-shell-sidebar border-border/80 h-auto w-full shrink-0 rounded-lg border bg-transparent text-[#3E3D3E] lg:w-52"
      >
        <SidebarContent className="px-2 py-3">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-px">
                {visibleTabs.map(({ id, label, icon: Icon }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      type="button"
                      isActive={activeTab === id}
                      className="text-[#3E3D3E]"
                      onClick={() => onTabChange(id)}
                    >
                      <Icon className="shrink-0" strokeWidth={1.75} />
                      <span className="font-medium">{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  )
}

export function normalizeClientDetailTab(
  value: string | null,
  showBillingAndEvents: boolean,
): ClientDetailTab {
  if (showBillingAndEvents && (value === 'billing' || value === 'events')) {
    return value
  }
  return 'info'
}
