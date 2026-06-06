import { LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { SupportUnreadBadge } from '@/components/admin/SupportUnreadBadge'
import { RallyLogo } from '@/components/brand/RallyLogo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useSupportUnreadCount } from '@/hooks/use-support-tickets'
import { cn } from '@/lib/utils'

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/clients', label: 'Clients', end: false },
  { to: '/admin/games', label: 'Games', end: false },
  { to: '/admin/support', label: 'Support', end: false },
] as const

export function RallyHubLayout() {
  const { signOut } = useAuth()
  const { data: supportUnread = 0 } = useSupportUnreadCount('support')

  return (
    <div className="bg-background min-h-svh">
      <header className="border-border/80 border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <RallyLogo className="h-8 w-auto max-w-[140px]" />
          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
            {links.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors',
                    isActive
                      ? 'bg-[#FFCB03]/15 text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )
                }
              >
                {label}
                {to === '/admin/support' ? (
                  <SupportUnreadBadge count={supportUnread} />
                ) : null}
              </NavLink>
            ))}
          </nav>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
