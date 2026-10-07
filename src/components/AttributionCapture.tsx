'use client'

import { useEffect } from 'react'
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_SECONDS,
  mergeAttribution,
  parseAttributionCookie,
  serializeAttributionCookie,
  touchFromVisit,
} from '@/lib/attribution'

function readCookie(name: string): string | null {
  const prefix = `${name}=`
  const match = document.cookie.split('; ').find((part) => part.startsWith(prefix))
  if (!match) return null
  try {
    return decodeURIComponent(match.slice(prefix.length))
  } catch {
    return null
  }
}

export default function AttributionCapture() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      // Returning from Stripe is not a new visit.
      if (url.pathname.endsWith('/payment/success')) return

      const existing = parseAttributionCookie(readCookie(ATTRIBUTION_COOKIE))
      const touch = touchFromVisit(url, document.referrer)
      const merged = mergeAttribution(existing, touch)
      if (merged === existing) return

      const value = serializeAttributionCookie(merged)
      if (!value) return

      const secure = window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `${ATTRIBUTION_COOKIE}=${value}; Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
    } catch {
      // Attribution is best effort and must never break the page.
    }
  }, [])

  return null
}
