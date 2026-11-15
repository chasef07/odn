'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { signInErrorMessage } from '@/components/admin/sign-in-error'
import { Button } from '@/components/ui/button'

const destinations = { provider: 'google', callbackURL: '/admin', errorCallbackURL: '/admin/login' }

export function GoogleSignInButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fail = (code: string) => {
    setError(signInErrorMessage(code))
    setIsLoading(false)
  }

  const signInWithGoogle = async () => {
    const result = await authClient.signIn.popup(destinations)
    if (!result.error) {
      router.replace('/admin')
      return
    }
    if (result.error.code !== 'POPUP_BLOCKED') {
      console.error('Google sign-in popup error:', result.error)
      fail(result.error.code)
      return
    }
    const redirect = await authClient.signIn.social(destinations)
    if (!redirect.error) return
    console.error('Google sign-in redirect error:', redirect.error)
    fail('redirect_failed')
  }

  const handleSignIn = async () => {
    setError('')
    setIsLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      console.error('Google sign-in exception:', err)
      fail('sign_in_failed')
    }
  }

  return (
    <div className="space-y-4">
      <Button type="button" className="w-full" disabled={isLoading} onClick={handleSignIn}>
        {isLoading ? 'Signing in with Google...' : 'Continue with Google'}
      </Button>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    </div>
  )
}
