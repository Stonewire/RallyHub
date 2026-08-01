import { Link } from 'react-router-dom'

import { useAuth } from '@/contexts/auth-context'
import { profileDisplayName } from '@/lib/auth-routes'

/** Header avatar: the user's photo when set, initials otherwise. */
export function HeaderAvatar() {
  const { profile } = useAuth()
  const name = profileDisplayName(profile)
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'

  return (
    <Link
      to="/admin/settings?tab=account"
      title="My Account"
      aria-label="My Account"
      className="bg-nm-slate-500 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold text-white"
    >
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </Link>
  )
}
