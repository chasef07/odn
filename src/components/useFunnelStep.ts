'use client'

import { useEffect } from 'react'
import { useI18n } from '@/components/i18n/I18nProvider'
import type { FunnelStep } from '@/lib/funnel'
import type { Locale } from '@/lib/i18n'

export const FUNNEL_VISITOR_KEY = 'odn-funnel-visitor'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function funnelVisitorId(): string | null {
  try {
    const stored = localStorage.getItem(FUNNEL_VISITOR_KEY)
    if (stored && UUID.test(stored)) return stored
    const created = crypto.randomUUID()
    localStorage.setItem(FUNNEL_VISITOR_KEY, created)
    return created
  } catch {
    return null
  }
}

export function sendFunnelStep(step: FunnelStep, locale: Locale): void {
  const visitorId = funnelVisitorId()
  if (!visitorId) return

  fetch('/api/funnel-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId, step, locale }),
    keepalive: true,
  }).catch((error) => console.warn('Failed to record funnel step:', error))
}

export const FUNNEL_VISIT_KEY = 'odn-funnel-visit'

export function sendFunnelVisitOnce(locale: Locale): void {
  try {
    if (sessionStorage.getItem(FUNNEL_VISIT_KEY)) return
    sessionStorage.setItem(FUNNEL_VISIT_KEY, '1')
  } catch {
    return
  }
  sendFunnelStep('visit', locale)
}

export function useFunnelStep(step: FunnelStep, enabled = true): void {
  const { locale } = useI18n()

  useEffect(() => {
    if (enabled) sendFunnelStep(step, locale)
  }, [step, locale, enabled])
}
