'use client'

import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/admin/login'
        },
      },
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      Sign Out
    </Button>
  )
}
