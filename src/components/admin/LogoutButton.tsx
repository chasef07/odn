'use client'

/**
 * Logout Button Component
 * Allows doctors to sign out of the admin portal
 */

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const handleLogout = async () => {
    await signOut({
      callbackUrl: '/admin/login',
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      Sign Out
    </Button>
  )
}
