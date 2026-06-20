import {
  Building2,
  Calendar,
  ChevronDown,
  CreditCard,
  Gamepad2,
  LifeBuoy,
  LogOut,
  Moon,
  Sun,
  UserCircle,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { RallyLogo } from '@/components/brand/RallyLogo'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { useSupportUnreadCount } from '@/hooks/use-support-tickets'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { canAccessOrgSettings, canManageOrgUsers } from '@/lib/auth-routes'
import { isAdminNavActive } from '@/lib/is-admin-nav-active'

const mainNav = [
  { to: '/admin/games', label: 'Games', icon: Gamepad2, end: false },
  { to: '/admin/events', label: 'Events', icon: Calendar, end: false },
] as const

const orgRoutes = [
  {
    to: '/admin/settings',
    label: 'Organization Profile',
    icon: UserCircle,
    tab: null,
  },
  {
    to: '/admin/settings',
    label: 'Billing',
    icon: CreditCard,
    tab: 'billing',
  },
] as const

export function AdminAppSidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const { signOut, role } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const { state: sidebarState } = useSidebar()
  const sidebarCollapsed = sidebarState === 'collapsed'
  const { data: supportUnread = 0 } = useSupportUnreadCount('client')
  const settingsTab = searchParams.get('tab')
  const showOrgSettings = canAccessOrgSettings(role)
  const showTeamNav = canManageOrgUsers(role) && !showOrgSettings

  const orgChildActive =
    pathname.startsWith('/admin/settings/') ||
    pathname === '/admin/settings'

  const [orgMenuOpenWhenBrowsing, setOrgMenuOpenWhenBrowsing] =
    React.useState(false)

  const orgMenuOpen = orgChildActive ? true : orgMenuOpenWhenBrowsing

  function onOrgMenuOpenChange(next: boolean) {
    if (orgChildActive && !next) return
    setOrgMenuOpenWhenBrowsing(next)
  }

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('[RallyHub] Sign out failed', err)
    }
  }

  return (
    <Sidebar
      collapsible="icon"
      className="admin-shell-sidebar neo-minimal-sidebar border-border/70 text-sidebar-foreground [&_*]:tracking-normal"
      style={{ color: 'var(--sidebar-foreground)' }}
    >
      <SidebarHeader className="border-sidebar-border shrink-0 border-b px-4 py-4">
        {/* Expanded: full logo left + sidebar trigger right */}
        <div className="group-data-[collapsible=icon]:hidden flex items-center justify-between gap-2">
          <RallyLogo
            mark="full"
            className="max-h-[52px] max-w-[160px] object-contain"
          />
          <SidebarTrigger className="text-sidebar-foreground shrink-0 opacity-60 hover:opacity-100" />
        </div>
        {/* Collapsed: just the trigger centered */}
        <div className="hidden group-data-[collapsible=icon]:flex justify-center">
          <SidebarTrigger className="text-sidebar-foreground" />
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
                      <Icon className="shrink-0" strokeWidth={1.75} />
                      <span className="font-medium">{label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {showTeamNav ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Team"
                    isActive={isAdminNavActive(pathname, '/admin/team', true)}
                    className="text-sidebar-foreground"
                  >
                    <NavLink to="/admin/team">
                      <Users className="shrink-0" strokeWidth={1.75} />
                      <span className="font-medium">Team</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}

              {showOrgSettings && sidebarCollapsed ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Org Settings"
                    isActive={orgChildActive}
                    className="text-sidebar-foreground"
                  >
                    <NavLink to="/admin/settings">
                      <Building2 className="shrink-0" strokeWidth={1.75} />
                      <span className="font-medium">Org Settings</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : showOrgSettings ? (
                <SidebarMenuItem>
                  <Collapsible
                    open={orgMenuOpen}
                    onOpenChange={onOrgMenuOpenChange}
                    className="group/org w-full"
                  >
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip="Org Settings"
                        isActive={false}
                        type="button"
                        className={[
                          'group admin-org-trigger font-medium text-sidebar-foreground',
                          orgChildActive ? 'admin-org-trigger-active' : '',
                        ].join(' ')}
                      >
                        <Building2 className="shrink-0" strokeWidth={1.75} />
                        <span className="font-medium">Org Settings</span>
                        <ChevronDown className="ml-auto shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="data-[state=closed]:animate-none">
                      <SidebarMenuSub>
                        {orgRoutes.map(({ to, label, icon: Icon, tab }) => {
                          const isActive =
                            pathname.startsWith('/admin/settings') &&
                            (tab === 'billing'
                              ? settingsTab === 'billing'
                              : settingsTab !== 'billing')

                          return (
                            <SidebarMenuSubItem key={label}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActive}
                                size="md"
                              >
                                <NavLink
                                  to={
                                    tab
                                      ? { pathname: to, search: `?tab=${tab}` }
                                      : to
                                  }
                                >
                                  <Icon className="shrink-0" strokeWidth={1.75} />
                                  <span>{label}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border mt-auto shrink-0 border-t p-2">
        <SidebarMenu className="gap-px">
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              className="text-sidebar-foreground"
              tooltip={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={toggleTheme}
            >
              {resolvedTheme === 'dark'
                ? <Sun className="shrink-0" strokeWidth={1.75} />
                : <Moon className="shrink-0" strokeWidth={1.75} />}
              <span className="font-medium">
                {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Support"
              isActive={isAdminNavActive(pathname, '/admin/support', true)}
              className="text-sidebar-foreground"
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
              className="text-sidebar-foreground"
              tooltip="Sign out"
              onClick={() => void handleSignOut()}
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
