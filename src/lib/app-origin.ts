/**
 * Origin to use for links that people open, copy, or encode in QR codes.
 *
 * In a browser this deliberately follows the page that is currently open. That
 * keeps Vercel branch previews, local development, staging, and production on
 * their own host instead of leaking links to the configured production domain.
 */
export function getCurrentAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location.origin !== 'null') {
    return window.location.origin.replace(/\/$/, '')
  }

  const platformHost = import.meta.env.VITE_PLATFORM_HOST ?? 'app.rallyhub.games'
  return `https://${platformHost}`
}
