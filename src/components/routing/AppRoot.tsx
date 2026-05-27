import { Outlet } from 'react-router-dom'

/** Root layout: no redirects, only renders the matched child route. */
export function AppRoot() {
  return <Outlet />
}
