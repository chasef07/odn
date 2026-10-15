declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

export const PURCHASE_EVENT = 'purchase'

const TRACKED_KEY_PREFIX = 'odn-purchase-tracked:'

const STRIPE_SECRET_PARAMS = ['payment_intent_client_secret']

export interface PurchaseConversion {
  transactionId: string
  amountCents: number
  currency: string
  emailSha256?: string | null
}

export function stripStripeSecretParams(): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  let changed = false
  for (const param of STRIPE_SECRET_PARAMS) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param)
      changed = true
    }
  }

  if (changed) {
    window.history.replaceState(window.history.state, '', url.toString())
  }
}

function hasTracked(transactionId: string): boolean {
  try {
    return Boolean(localStorage.getItem(TRACKED_KEY_PREFIX + transactionId))
  } catch {
    return false
  }
}

function markTracked(transactionId: string): void {
  try {
    localStorage.setItem(TRACKED_KEY_PREFIX + transactionId, new Date().toISOString())
  } catch {}
}

export function trackPurchaseOnce(conversion: PurchaseConversion): boolean {
  if (typeof window === 'undefined') return false
  if (!conversion.transactionId || hasTracked(conversion.transactionId)) return false

  const event: Record<string, unknown> = {
    event: PURCHASE_EVENT,
    transaction_id: conversion.transactionId,
    value: conversion.amountCents / 100,
    currency: conversion.currency.toUpperCase(),
  }

  if (conversion.emailSha256) {
    event.user_data = { sha256_email_address: conversion.emailSha256 }
  }

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(event)
  markTracked(conversion.transactionId)
  return true
}

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

export function normalizeEmailForConversions(email: string): string {
  const normalized = email.trim().toLowerCase()
  const at = normalized.lastIndexOf('@')
  if (at === -1) return normalized

  const domain = normalized.slice(at + 1)
  if (!GMAIL_DOMAINS.has(domain)) return normalized

  const username = normalized.slice(0, at).split('+')[0].replace(/\./g, '')
  return `${username}@${domain}`
}
