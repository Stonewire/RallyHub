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
import { InstallAppButton } from '@/components/pwa/InstallAppButton'
import { useSidebar } from '@/components/ui/sidebar'
import { useAuth } from '@/contexts/auth-context'
import { useTenant } from '@/contexts/tenant-context'
import { useTheme } from '@/contexts/theme-context'
import { isFacilitatorOnlyRole } from '@/lib/auth-routes'

const ICON_BUTTON =
  'hover:bg-muted rounded-nm-md flex size-8 items-center justify-center'

function Divider() {
  return <div className="bg-border h-5 w-px shrink-0" aria-hidden />
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

  // Facilitators cannot create games or events, so those CTAs stay hidden.
  const canCreate = !isFacilitatorOnlyRole(role)
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
          {/* A panel glyph rather than an arrow: it says what the control acts
              on, not just which way it moves. */}
          <IconPanelLeft className="size-4" />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <HeaderSearch />

          {canCreate ? (
            <>
              <Divider />
              <button
                type="button"
                onClick={() => setNewGameOpen(true)}
                className="border-input bg-nm-surface hover:bg-muted rounded-nm-md flex h-8 shrink-0 items-center gap-1.5 border px-3 text-xs font-semibold whitespace-nowrap"
              >
                <IconGames className="size-4" />
                New Game
              </button>
              <Link
                to="/admin/events/new"
                className="bg-nm-yellow text-nm-charcoal rounded-nm-md flex h-8 shrink-0 items-center gap-1.5 px-3 text-xs font-semibold whitespace-nowrap"
              >
                <IconEvents className="size-4" />
                New Event
              </Link>
            </>
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
              onClick={() => void handleExit()}
              aria-label="Exit"
              className={ICON_BUTTON}
            >
              <IconSignOut className="size-3.5" />
            </button>
          ) : null}

          <Divider />
          <HeaderAvatar />
        </div>
      </header>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <NewGameTypeModal open={newGameOpen} onClose={() => setNewGameOpen(false)} />

      {loggedOut ? (
        <LoggedOutScreen
          onLogBackIn={() => navigate('/login', { replace: true })}
        />
      ) : null}
    </>
  )
}
