import { NavLink, useLocation } from 'react-router-dom'

import {
  IconBilling,
  IconDashboard,
  IconGames,
  IconOrganisation,
  IconSupport,
  IconTicket,
} from '@/components/icons'

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
import { useSupportUnreadCount } from '@/hooks/use-support-tickets'
import { isAdminNavActive } from '@/lib/is-admin-nav-active'
import { APP_BUILD_LABEL } from '@/lib/version'
import { cn } from '@/lib/utils'

// Support lives in the footer, as on the client sidebar, so the top group is
// only the places a super-admin works in.
const mainNav = [
  { to: '/admin', label: 'Dashboard', icon: IconDashboard, end: true },
  { to: '/admin/clients', label: 'Clients', icon: IconOrganisation, end: false },
  { to: '/admin/games', label: 'Games', icon: IconGames, end: false },
  { to: '/admin/payments', label: 'Payments', icon: IconBilling, end: false },
  { to: '/admin/promo-codes', label: 'Promo Codes', icon: IconTicket, end: false },
] as const

export function RallyHubAppSidebar() {
  const { pathname } = useLocation()
  const { data: supportUnread = 0 } = useSupportUnreadCount('support')

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        'admin-shell-sidebar border-border/70 text-sidebar-foreground [&_*]:tracking-normal',
      )}
      style={{ color: 'var(--sidebar-foreground)' }}
    >
      <SidebarHeader className="border-sidebar-border shrink-0 border-b px-5 py-6">
        {/* Theme-following logo, same as the client sidebar: charcoal art on
            the light sidebar, ivory on the dark one. The forced dark variant
            was white-on-white in light mode. */}
        <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <RallyLogo
            mark="full"
            className="group-data-[collapsible=icon]:hidden max-h-[52px] w-full max-w-[170px] object-contain"
          />
          <RallyLogo
            mark="profile"
            className="hidden size-8 shrink-0 object-contain group-data-[collapsible=icon]:block"
          />
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
                    className="text-sidebar-foreground"
                  >
                    <NavLink to={to} end={end}>
                      <Icon className="shrink-0" />
                      <span className="font-medium">{label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Theme toggle and sign-out live in the header, as on the client
          sidebar; the footer carries Support and the build label. */}
      <SidebarFooter className="border-sidebar-border mt-auto shrink-0 border-t p-2">
        <SidebarMenu className="gap-px">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Support"
              isActive={isAdminNavActive(pathname, '/admin/support', true)}
              className="text-sidebar-foreground"
            >
              <NavLink to="/admin/support" className="justify-center">
                <IconSupport className="size-4" />
                <span className="font-medium">Support</span>
              </NavLink>
            </SidebarMenuButton>
            {supportUnread > 0 ? (
              <SidebarMenuBadge className="bg-red-600 text-[10px] font-bold text-white">
                {supportUnread > 9 ? '9+' : supportUnread}
              </SidebarMenuBadge>
            ) : null}
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="text-sidebar-foreground/40 px-2 pt-1 text-[10px] tracking-wide">
          {APP_BUILD_LABEL}
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
