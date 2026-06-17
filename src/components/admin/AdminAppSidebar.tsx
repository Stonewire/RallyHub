import {
  Building2,
  Calendar,
  ChevronDown,
  CreditCard,
  Gamepad2,
  LifeBuoy,
  LogOut,
  UserCircle,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { RallySidebarLogo } from '@/components/brand/RallyLogo'
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
} from '@/components/ui/sidebar'
import { useSupportUnreadCount } from '@/hooks/use-support-tickets'
import { useAuth } from '@/contexts/auth-context'
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
      className="admin-shell-sidebar neo-minimal-sidebar border-border/70 text-[#3E3D3E] [&_*]:tracking-normal"
      style={{
        /** Ensure nav label color even inside nested spans */
        color: 'var(--foreground)',
      }}
    >
      <SidebarHeader className="border-sidebar-border shrink-0 border-b px-5 py-6">
        <div className="group-data-[collapsible=icon]/sidebar:flex group-data-[collapsible=icon]/sidebar:justify-center">
          <RallySidebarLogo />
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

              {showTeamNav ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="Team"
                    isActive={isAdminNavActive(pathname, '/admin/team', true)}
                    className="text-[#3E3D3E]"
                  >
                    <NavLink to="/admin/team">
                      <Users className="shrink-0" strokeWidth={1.75} />
                      <span className="font-medium">Team</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}

              {showOrgSettings ? (
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
                          'group admin-org-trigger font-medium text-[#3E3D3E]',
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
