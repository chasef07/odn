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
import { localeFromPathname } from '@/lib/i18n'
import { sendFunnelVisitOnce } from '@/components/useFunnelStep'

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

function writeAttributionCookie(url: URL): void {
  try {
    const existing = parseAttributionCookie(readCookie(ATTRIBUTION_COOKIE))
    const touch = touchFromVisit(url, document.referrer)
    const merged = mergeAttribution(existing, touch)
    if (merged === existing) return

    const value = serializeAttributionCookie(merged)
    if (!value) return

    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${ATTRIBUTION_COOKIE}=${value}; Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
  } catch {}
}

function isFunnelVisit(pathname: string): boolean {
  return !pathname.endsWith('/approved') && !pathname.startsWith('/admin')
}

export default function AttributionCapture() {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.pathname.endsWith('/payment/success')) return

    writeAttributionCookie(url)
    if (isFunnelVisit(url.pathname)) sendFunnelVisitOnce(localeFromPathname(url.pathname))
  }, [])

  return null
}
