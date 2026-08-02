import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  IconMoon,
  IconOrganisation,
  IconPanelLeft,
  IconSearch,
  IconSignOut,
  IconSun,
  IconTicket,
} from '@/components/icons'
import { LoggedOutScreen } from '@/components/auth/LoggedOutScreen'
import { HeaderAvatar } from '@/components/shell/HeaderAvatar'
import { useSidebar } from '@/components/ui/sidebar'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { staffCanEditClients, staffCanSeePromoCodes } from '@/lib/auth-routes'
import { useRallyHubClients } from '@/hooks/use-rallyhub'

const ICON_BUTTON = 'hover:bg-muted rounded-nm-md flex size-8 items-center justify-center'

function Divider() {
  return <div className="bg-border h-5 w-px shrink-0" aria-hidden />
}

/** Header search over clients: the platform's one global entity. */
function ClientSearch() {
  const navigate = useNavigate()
  const { data } = useRallyHubClients()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [])

  const trimmed = query.trim().toLowerCase()
  const matches =
    trimmed.length >= 2
      ? (data ?? [])
          .filter(
            (client) =>
              client.name.toLowerCase().includes(trimmed) ||
              (client.subdomain ?? '').toLowerCase().includes(trimmed) ||
              (client.email ?? '').toLowerCase().includes(trimmed),
          )
          .slice(0, 8)
      : []

  return (
    <div ref={boxRef} className="relative w-60">
      <IconSearch className="text-nm-neutral-600 pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search clients…"
        aria-label="Search clients"
        className="border-input bg-nm-surface h-8 w-full rounded-nm-md border pr-3 pl-8 text-xs"
      />
      {open && trimmed.length >= 2 ? (
        <div className="border-border bg-card absolute top-9 right-0 left-0 z-40 rounded-md border p-1 shadow-lg">
          {matches.length === 0 ? (
            <p className="text-muted-foreground px-2 py-1.5 text-xs">No clients match.</p>
          ) : (
            matches.map((client) => (
              <button
                key={client.id}
                type="button"
                className="hover:bg-muted/50 block w-full rounded px-2 py-1.5 text-left text-sm"
                onClick={() => {
                  setOpen(false)
                  setQuery('')
                  navigate(`/admin/clients/${client.id}`)
                }}
              >
                <span className="text-foreground font-medium">{client.name}</span>
                {client.subdomain ? (
                  <span className="text-muted-foreground ml-2 font-mono text-xs">
                    {client.subdomain}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The platform header: the client admin header with the platform's verbs.
 * New Client and New Code replace New Game and New Event; everything else
 * (collapse, search, theme, sign out, avatar) matches.
 */
export function RallyHubHeader() {
  const navigate = useNavigate()
  const { toggleSidebar, state } = useSidebar()
  const { resolvedTheme, toggleTheme } = useTheme()
  const { signOut, profile } = useAuth()
  const staffRole = profile?.staff_role
  const [loggedOut, setLoggedOut] = useState(false)
  const collapsed = state === 'collapsed'

  async function handleExit() {
    if (!window.confirm('Log out of RallyHub? You will need to sign in again.')) {
      return
    }
    try {
      await signOut()
      setLoggedOut(true)
    } catch (err) {
      console.error('[RallyHub] Sign out failed', err)
    }
  }

  return (
    <>
      <header className="border-border bg-background flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`${ICON_BUTTON} opacity-70 hover:opacity-100`}
        >
          <IconPanelLeft className="size-4" />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <ClientSearch />

          <Divider />
          {/* The platform's create verbs, reachable from anywhere, scoped to
              the tiers that own them. */}
          {staffCanSeePromoCodes(staffRole) ? (
          <Link
            to="/admin/promo-codes?new=1"
            className="border-input bg-nm-surface hover:bg-muted rounded-nm-md flex h-8 shrink-0 items-center gap-1.5 border px-3 text-xs font-semibold whitespace-nowrap"
          >
            <IconTicket className="size-4" />
            New Code
          </Link>
          ) : null}
          {staffCanEditClients(staffRole) ? (
          <Link
            to="/admin/clients/new"
            className="bg-nm-yellow text-nm-charcoal rounded-nm-md flex h-8 shrink-0 items-center gap-1.5 px-3 text-xs font-semibold whitespace-nowrap"
          >
            <IconOrganisation className="size-4" />
            New Client
          </Link>
          ) : null}

          <Divider />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            className={ICON_BUTTON}
          >
            {resolvedTheme === 'dark' ? (
              <IconMoon className="size-4" />
            ) : (
              <IconSun className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleExit()}
            aria-label="Exit"
            className={ICON_BUTTON}
          >
            <IconSignOut className="size-3.5" />
          </button>

          <Divider />
          <HeaderAvatar />
        </div>
      </header>

      {loggedOut ? (
        <LoggedOutScreen onLogBackIn={() => navigate('/login', { replace: true })} />
      ) : null}
    </>
  )
}
