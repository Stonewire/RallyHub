import {
  Building2,
  Gamepad2,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useAuth } from '@/contexts/auth-context'
import { useSupportUnreadCount } from '@/hooks/use-support-tickets'
import { isAdminNavActive } from '@/lib/is-admin-nav-active'

const mainNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/clients', label: 'Clients', icon: Building2, end: false },
  { to: '/admin/games', label: 'Games', icon: Gamepad2, end: false },
] as const

export function RallyHubAppSidebar() {
  const { pathname } = useLocation()
  const { signOut } = useAuth()
  const { data: supportUnread = 0 } = useSupportUnreadCount('support')

  return (
    <Sidebar
      collapsible="icon"
      className="admin-shell-sidebar border-border/70 text-[#3E3D3E] [&_*]:tracking-normal"
      style={{ color: 'var(--foreground)' }}
    >
      <SidebarHeader className="border-sidebar-border shrink-0 border-b px-5 py-6">
        <div className="group-data-[collapsible=icon]/sidebar:flex group-data-[collapsible=icon]/sidebar:justify-center">
          <RallyLogo className="group-data-[collapsible=icon]/sidebar:!max-h-8 group-data-[collapsible=icon]/sidebar:!w-auto max-h-[52px] w-full max-w-[200px]" />
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-1 flex-col gap-0 px-2 py-5">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {mainNav.map(({ to, label, icon: Icon, end }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    asChild
                    tooltip={label}
                    isActive={isAdminNavActive(pathname, to, end)}
                    className="text-[#3E3D3E]"
                  >
                    <NavLink to={to} end={end}>
                      <Icon className="shrink-0" strokeWidth={1.75} />
                      <span className="font-medium">{label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border mt-auto shrink-0 border-t p-2">
        <SidebarMenu className="gap-px">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Support"
              isActive={isAdminNavActive(pathname, '/admin/support', true)}
              className="text-[#3E3D3E]"
            >
              <NavLink to="/admin/support">
                <LifeBuoy className="shrink-0" strokeWidth={1.75} />
                <span className="font-medium">Support</span>
              </NavLink>
            </SidebarMenuButton>
            {supportUnread > 0 ? (
              <SidebarMenuBadge className="bg-red-600 text-[10px] font-bold text-white">
                {supportUnread > 9 ? '9+' : supportUnread}
              </SidebarMenuBadge>
            ) : null}
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              className="text-[#3E3D3E]"
              tooltip="Sign out"
              onClick={() => void signOut()}
            >
              <LogOut className="shrink-0" strokeWidth={1.75} />
              <span className="font-medium">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
