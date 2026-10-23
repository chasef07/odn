'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

export function GoogleSignInButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignIn = async () => {
    setError('')
    setIsLoading(true)
    try {
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/admin',
        errorCallbackURL: '/admin/login',
      })
      if (!result.error) return
      console.error('Google sign-in error:', result.error)
    } catch (err) {
      console.error('Google sign-in exception:', err)
    }
    setError('Google sign-in could not start. Please try again.')
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <Button type="button" className="w-full" disabled={isLoading} onClick={handleSignIn}>
        {isLoading ? 'Redirecting to Google...' : 'Continue with Google'}
      </Button>
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    </div>
  )
}
