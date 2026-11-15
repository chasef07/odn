'use client'

import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'

export function AdminSessionRefresh() {
  useEffect(() => {
    authClient
      .getSession()
      .then(({ error }) => {
        if (error) console.error('Admin session refresh failed:', error)
      })
      .catch((err) => console.error('Admin session refresh failed:', err))
  }, [])
  return null
}
