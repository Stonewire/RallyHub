/** Where Supabase sends users after they click the reset link in email. */
export function passwordResetRedirectUrl(): string {
  return `${window.location.origin}/login/reset`
}

export const PASSWORD_RESET_REQUEST_CONFIRMATION =
  'If an account exists for that email, a reset link has been sent.'

export const PASSWORD_UPDATED_MESSAGE =
  'Your password has been updated. Sign in with your new password.'
