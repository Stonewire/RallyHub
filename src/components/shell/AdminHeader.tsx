import { IconSignOut } from '@/components/icons'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  IconEvents,
  IconGames,
  IconHelp,
  IconPanelLeft,
  IconMoon,
  IconSun,
} from '@/components/icons'
import { LoggedOutScreen } from '@/components/auth/LoggedOutScreen'
import { HeaderAvatar } from '@/components/shell/HeaderAvatar'
import { HeaderSearch } from '@/components/shell/HeaderSearch'
import { HelpModal } from '@/components/shell/HelpModal'
import { NewGameTypeModal } from '@/components/games/NewGameTypeModal'
import { SignOutConfirmDialog } from '@/components/shell/SignOutConfirmDialog'
import { InstallAppButton } from '@/components/pwa/InstallAppButton'
import { useSidebar } from '@/components/ui/sidebar'
import { useAuth } from '@/contexts/auth-context'
import { useTenant } from '@/contexts/tenant-context'
import { useTheme } from '@/contexts/theme-context'
import { isFacilitatorOnlyRole } from '@/lib/auth-routes'

const ICON_BUTTON =
  'hover:bg-muted rounded-nm-md flex size-8 items-center justify-center'

function Divider({ className = '' }: { className?: string }) {
  return <div className={`bg-border h-5 w-px shrink-0 ${className}`} aria-hidden />
}

/** The admin header. Composition only, owns no data of its own. */
export function AdminHeader() {
  const navigate = useNavigate()
  const { toggleSidebar, state } = useSidebar()
  const { resolvedTheme, toggleTheme } = useTheme()
  const { role, signOut } = useAuth()
  const { tenantOrg } = useTenant()
  const [helpOpen, setHelpOpen] = useState(false)
  const [newGameOpen, setNewGameOpen] = useState(false)
  const [loggedOut, setLoggedOut] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Facilitators cannot create games or events, so those CTAs stay hidden.
  const canCreate = !isFacilitatorOnlyRole(role)
  const collapsed = state === 'collapsed'

  async function handleExit() {
    setSigningOut(true)
    try {
      await signOut()
      setExitOpen(false)
      setLoggedOut(true)
    } catch (err) {
      console.error('[RallyHub] Sign out failed', err)
    } finally {
      setSigningOut(false)
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
          {/* A panel glyph rather than an arrow: it says what the control acts
              on, not just which way it moves. */}
          <IconPanelLeft className="size-4" />
        </button>

        <div className="flex-1" />

        {/* The header used to lay out at a fixed 662px, so on a phone New Event,
            the theme toggle, Help and the avatar sat past the right edge with
            no way to scroll to them: an admin on a phone could not create an
            event or reach My Account at all. Below sm the search collapses and
            the create buttons drop to their icons, which are duplicated on the
            Events and Games pages anyway, so everything stays reachable. */}
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="hidden sm:block">
            <HeaderSearch />
          </div>

          {canCreate ? (
            <>
              <Divider className="hidden sm:block" />
              <button
                type="button"
                onClick={() => setNewGameOpen(true)}
                aria-label="New Game"
                className="border-input bg-nm-surface hover:bg-muted rounded-nm-md flex h-8 shrink-0 items-center gap-1.5 border px-2 text-xs font-semibold whitespace-nowrap sm:px-3"
              >
                <IconGames className="size-4" />
                <span className="hidden sm:inline">New Game</span>
              </button>
              <Link
                to="/admin/events/new"
                aria-label="New Event"
                className="bg-nm-yellow text-nm-charcoal rounded-nm-md flex h-8 shrink-0 items-center gap-1.5 px-2 text-xs font-semibold whitespace-nowrap sm:px-3"
              >
                <IconEvents className="size-4" />
                <span className="hidden sm:inline">New Event</span>
              </Link>
            </>
          ) : null}

          <Divider className="hidden sm:block" />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            className={ICON_BUTTON}
          >
            {/* Icon reflects the CURRENT theme, per the design. The label
                still describes the action, which is what screen readers need. */}
            {resolvedTheme === 'dark' ? (
              <IconMoon className="size-4" />
            ) : (
              <IconSun className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Help"
            className={ICON_BUTTON}
          >
            <IconHelp className="size-4" />
          </button>
          {/* Renders nothing unless this browser can actually install, so the
              row does not carry a button that would do nothing. */}
          <InstallAppButton
            iconOnly
            label="Install RallyHub as an app"
            className={ICON_BUTTON}
          />
          {/* The public demo has no real session to end, so it hides Exit,
              matching how the demo suppresses sign-out elsewhere. */}
          {!tenantOrg?.is_demo ? (
            <button
              type="button"
              onClick={() => setExitOpen(true)}
              aria-label="Exit"
              className={ICON_BUTTON}
            >
              <IconSignOut className="size-3.5" />
            </button>
          ) : null}

          <Divider className="hidden sm:block" />
          <HeaderAvatar />
        </div>
      </header>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <NewGameTypeModal open={newGameOpen} onClose={() => setNewGameOpen(false)} />
      {exitOpen ? (
        <SignOutConfirmDialog
          signingOut={signingOut}
          onCancel={() => setExitOpen(false)}
          onConfirm={() => void handleExit()}
        />
      ) : null}

      {loggedOut ? (
        <LoggedOutScreen
          onLogBackIn={() => navigate('/login', { replace: true })}
        />
      ) : null}
    </>
  )
}
