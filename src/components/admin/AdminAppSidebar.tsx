import { UserCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconUsers } from '@/components/icons'
import { NavLink, useLocation, useSearchParams } from 'react-router-dom'

import {
  IconBilling,
  IconDashboard,
  IconEvents,
  IconGames,
  IconOrganisation,
  IconSupport,
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
  useSidebar,
} from '@/components/ui/sidebar'
import { useSupportUnreadCount } from '@/hooks/use-support-tickets'
import { useAuth } from '@/contexts/auth-context'
import { useTenant, useOptionalTenant } from '@/contexts/tenant-context'
import { orgPath } from '@/lib/org-path'
import {
  canAccessOrgSettings,
  canManageOrgUsers,
  isFacilitatorOnlyRole,
} from '@/lib/auth-routes'
import { isAdminNavActive } from '@/lib/is-admin-nav-active'
import { APP_BUILD_LABEL } from '@/lib/version'

const mainNav = [
  { to: '/admin', labelKey: 'nav.dashboard', icon: IconDashboard, end: true, tourId: 'nav-dashboard' },
  { to: '/admin/games', labelKey: 'nav.games', icon: IconGames, end: false, tourId: 'nav-games' },
  { to: '/admin/events', labelKey: 'nav.events', icon: IconEvents, end: false, tourId: 'nav-events' },
] as const

// The new design shows Organisation and Billing as flat top-level items rather
// than nested under a collapsible Org Settings group. Both still land on the
// existing settings routes underneath.
const orgNav = [
  {
    to: '/admin/settings',
    search: '',
    labelKey: 'nav.organisation',
    icon: IconOrganisation,
    tourId: 'nav-org-settings',
  },
  {
    to: '/admin/settings',
    search: '?tab=billing',
    labelKey: 'nav.billing',
    icon: IconBilling,
    tourId: 'nav-billing',
  },
] as const

export function AdminAppSidebar() {
  // Choosing a section closes the mobile sheet — the menu is a launcher,
  // not a place to stay (Rumen, 9 Aug).
  const { t } = useTranslation('admin')
  const { setOpenMobile } = useSidebar()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const { role } = useAuth()
  const { tenantOrg } = useTenant()
  const clientSlug = useOptionalTenant()?.tenantOrg?.subdomain ?? null
  // Item 7: sidebar is always charcoal, so a client's *light* logo replaces ours.
  const clientLogo = tenantOrg?.logo_light_url ?? null
  const { data: supportUnread = 0 } = useSupportUnreadCount('client')
  const settingsTab = searchParams.get('tab')
  const isFacilitator = isFacilitatorOnlyRole(role)
  const showOrgSettings = canAccessOrgSettings(role)
  const showTeamNav = canManageOrgUsers(role) && !showOrgSettings
  // event_manager has no org-wide Settings access but still needs somewhere
  // to edit their own name/username/email/password.
  const showPersonalProfileNav = isFacilitator || role === 'event_manager'
  // Facilitators get a stripped nav: their events list + their own profile.
  const visibleMainNav = isFacilitator
    ? mainNav.filter((item) => item.to === '/admin/events')
    : mainNav

  return (
    <Sidebar
      collapsible="icon"
      className="admin-shell-sidebar border-border/70 text-sidebar-foreground [&_*]:tracking-normal"
      style={{ color: 'var(--sidebar-foreground)' }}
    >
      <SidebarHeader className="border-sidebar-border shrink-0 border-b px-5 py-6">
        {/* Sidebar follows the theme now, so the logo does too: charcoal art on
            the light sidebar, ivory on the dark one. */}
        <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          {clientLogo ? (
            <img
              src={clientLogo}
              alt=""
              className="group-data-[collapsible=icon]:hidden max-h-[52px] w-full max-w-[170px] object-contain"
            />
          ) : (
            <RallyLogo
              mark="full"
              className="group-data-[collapsible=icon]:hidden max-h-[52px] w-full max-w-[170px] object-contain"
            />
          )}
          {clientLogo ? (
            <img
              src={clientLogo}
              alt=""
              className="hidden size-8 shrink-0 object-contain group-data-[collapsible=icon]:block"
            />
          ) : (
            <RallyLogo
              mark="profile"
              className="hidden size-8 shrink-0 object-contain group-data-[collapsible=icon]:block"
            />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-1 flex-col gap-0 px-2 py-5">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {visibleMainNav.map(({ to, labelKey, icon: Icon, end, tourId }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    asChild
                    tooltip={t(labelKey)}
                    isActive={isAdminNavActive(pathname, orgPath(clientSlug, to), end)}
                    className="text-sidebar-foreground"
                  >
                    <NavLink to={orgPath(clientSlug, to)} end={end} data-tour={tourId} onClick={() => setOpenMobile(false)}>
                      <Icon className="shrink-0" />
                      <span className="font-medium">{t(labelKey)}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {showPersonalProfileNav ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t('nav.profile')}
                    isActive={isAdminNavActive(pathname, orgPath(clientSlug, '/admin/settings'), true)}
                    className="text-sidebar-foreground"
                  >
                    <NavLink to={orgPath(clientSlug, "/admin/settings")} onClick={() => setOpenMobile(false)}>
                      <UserCircle className="shrink-0" strokeWidth={1.75} />
                      <span className="font-medium">{t('nav.profile')}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}

              {showTeamNav ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t('nav.team')}
                    isActive={isAdminNavActive(pathname, orgPath(clientSlug, '/admin/team'), true)}
                    className="text-sidebar-foreground"
                  >
                    <NavLink to={orgPath(clientSlug, "/admin/team")} onClick={() => setOpenMobile(false)}>
                      <IconUsers className="shrink-0" />
                      <span className="font-medium">{t('nav.team')}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}

              {showOrgSettings
                ? orgNav.map(({ to, search, labelKey, icon: Icon, tourId }) => {
                    const onSettings = pathname.startsWith(orgPath(clientSlug, '/admin/settings'))
                    const isActive =
                      search === '?tab=billing'
                        ? onSettings && settingsTab === 'billing'
                        : onSettings &&
                          settingsTab !== 'billing' &&
                          settingsTab !== 'account'

                    return (
                      <SidebarMenuItem key={labelKey}>
                        <SidebarMenuButton
                          asChild
                          tooltip={t(labelKey)}
                          isActive={isActive}
                          className="text-sidebar-foreground"
                        >
                          <NavLink
                            to={search ? { pathname: orgPath(clientSlug, to), search } : orgPath(clientSlug, to)}
                            data-tour={tourId}
                          >
                            <Icon className="shrink-0" />
                            <span className="font-medium">{t(labelKey)}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })
                : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Theme toggle and sign-out moved to the header, per the new design. */}
      <SidebarFooter className="border-sidebar-border mt-auto shrink-0 border-t p-2">
        {!isFacilitator ? (
          <SidebarMenu className="gap-px">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={t('nav.support')}
                isActive={isAdminNavActive(pathname, orgPath(clientSlug, '/admin/support'), true)}
                className="text-sidebar-foreground"
              >
                <NavLink to={orgPath(clientSlug, "/admin/support")} data-tour="nav-support" className="justify-center" onClick={() => setOpenMobile(false)}>
                  <IconSupport className="size-4" />
                  <span className="font-medium">{t('nav.support')}</span>
                </NavLink>
              </SidebarMenuButton>
              {supportUnread > 0 ? (
                <SidebarMenuBadge className="bg-red-600 text-[10px] font-bold text-white">
                  {supportUnread > 9 ? '9+' : supportUnread}
                </SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
        <p className="text-sidebar-foreground/40 px-2 pt-1 text-[10px] tracking-wide">
          {APP_BUILD_LABEL}
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
