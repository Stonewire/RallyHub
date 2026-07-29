import { ChevronLeft, DoorOpen, HelpCircle, Moon, Plus, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { LoggedOutScreen } from '@/components/auth/LoggedOutScreen'
import { HeaderAvatar } from '@/components/shell/HeaderAvatar'
import { HeaderSearch } from '@/components/shell/HeaderSearch'
import { HelpModal } from '@/components/shell/HelpModal'
import { useSidebar } from '@/components/ui/sidebar'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { isFacilitatorOnlyRole } from '@/lib/auth-routes'

const ICON_BUTTON =
  'hover:bg-muted rounded-nm-md flex size-[26px] items-center justify-center'

function Divider() {
  return <div className="bg-border h-[18px] w-px shrink-0" aria-hidden />
}

/** The 40px admin header. Composition only, owns no data of its own. */
export function AdminHeader() {
  const navigate = useNavigate()
  const { toggleSidebar, state } = useSidebar()
  const { resolvedTheme, toggleTheme } = useTheme()
  const { role, signOut } = useAuth()
  const [helpOpen, setHelpOpen] = useState(false)
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
      <header className="border-border bg-background flex h-10 shrink-0 items-center gap-3 border-b px-4">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`${ICON_BUTTON} opacity-70 hover:opacity-100`}
        >
          <ChevronLeft
            className={`size-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <HeaderSearch />

          {canCreate ? (
            <>
              <Divider />
              <Link
                to="/admin/games"
                className="border-input bg-nm-surface hover:bg-muted rounded-nm-md flex h-[26px] shrink-0 items-center gap-1.5 border px-2.5 text-xs font-semibold whitespace-nowrap"
              >
                <Plus className="size-3" strokeWidth={2} />
                New Game
              </Link>
              <Link
                to="/admin/events/new"
                className="bg-nm-yellow text-nm-charcoal rounded-nm-md flex h-[26px] shrink-0 items-center gap-1.5 px-2.5 text-xs font-semibold whitespace-nowrap"
              >
                <Plus className="size-3" strokeWidth={2} />
                New Event
              </Link>
            </>
          ) : null}

          <Divider />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
            className={ICON_BUTTON}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="size-3.5" strokeWidth={2} />
            ) : (
              <Moon className="size-3.5" strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Help"
            className={ICON_BUTTON}
          >
            <HelpCircle className="size-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => void handleExit()}
            aria-label="Exit"
            className={ICON_BUTTON}
          >
            <DoorOpen className="size-3.5" strokeWidth={2} />
          </button>

          <Divider />
          <HeaderAvatar />
        </div>
      </header>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {loggedOut ? (
        <LoggedOutScreen
          onLogBackIn={() => navigate('/login', { replace: true })}
        />
      ) : null}
    </>
  )
}
