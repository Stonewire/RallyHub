import {
  Building2,
  CreditCard,
  Gamepad2,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Moon,
  Sun,
  Ticket,
} from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

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
import { useTheme } from '@/contexts/theme-context'
import { useSupportUnreadCount } from '@/hooks/use-support-tickets'
import { isAdminNavActive } from '@/lib/is-admin-nav-active'
import { cn } from '@/lib/utils'

const mainNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/clients', label: 'Clients', icon: Building2, end: false },
  { to: '/admin/games', label: 'Games', icon: Gamepad2, end: false },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard, end: false },
  { to: '/admin/promo-codes', label: 'Promo Codes', icon: Ticket, end: false },
  { to: '/admin/support', label: 'Support', icon: LifeBuoy, end: true },
] as const

export function RallyHubAppSidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { signOut } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const { data: supportUnread = 0 } = useSupportUnreadCount('support')

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
      className={cn(
        'admin-shell-sidebar border-border/70 text-sidebar-foreground [&_*]:tracking-normal',
      )}
      style={{ color: 'var(--sidebar-foreground)' }}
    >
      <SidebarHeader className="border-sidebar-border shrink-0 border-b px-5 py-6">
        {/* Sidebar is always charcoal → always the Ivory + Yellow logo. */}
        <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <RallyLogo
            mark="full"
            theme="dark"
            className="group-data-[collapsible=icon]:hidden max-h-[52px] w-full max-w-[170px] object-contain"
          />
          <RallyLogo
            mark="profile"
            theme="dark"
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
                  {to === '/admin/support' && supportUnread > 0 ? (
                    <SidebarMenuBadge className="bg-red-600 text-[10px] font-bold text-white">
                      {supportUnread > 9 ? '9+' : supportUnread}
                    </SidebarMenuBadge>
                  ) : null}
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
