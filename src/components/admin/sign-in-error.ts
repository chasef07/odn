export function signInErrorMessage(code: string): string {
  if (code === 'not_an_admin') {
    return 'This Google account is not allowed to use the admin portal. Sign in with the account your administrator added.'
  }
  if (code === 'POPUP_CLOSED') return 'Google sign-in was closed. Please try again.'
  return 'Google sign-in did not finish. Please try again.'
}
