/**
 * The marketing site (rallyhub.games) and the app (app.rallyhub.games) are
 * different origins. React Router <Link> only works for same-origin
 * client-side navigation, so every marketing "Log in" / "Create account"
 * link must be a plain <a> to these absolute URLs, not a <Link to="/login">.
 */
const APP_HOST = import.meta.env.VITE_PLATFORM_HOST ?? 'app.rallyhub.games'

export const APP_LOGIN_URL = `https://${APP_HOST}/login`
export const APP_REGISTER_URL = `https://${APP_HOST}/register`
