import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  normalizeEmailForConversions,
  PURCHASE_EVENT,
  trackPurchaseOnce,
} from '@/lib/conversion-tracking'

const conversion = {
  transactionId: 'pi_123',
  amountCents: 2495,
  currency: 'usd',
  emailSha256: 'abc123',
}

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  }
}

describe('trackPurchaseOnce', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    delete window.dataLayer
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pushes a purchase event with value, currency, transaction id and hashed email', () => {
    expect(trackPurchaseOnce(conversion)).toBe(true)

    expect(window.dataLayer).toEqual([
      {
        event: PURCHASE_EVENT,
        transaction_id: 'pi_123',
        value: 24.95,
        currency: 'USD',
        user_data: { sha256_email_address: 'abc123' },
      },
    ])
  })

  it('does not push again for the same payment intent (refresh or revisit)', () => {
    trackPurchaseOnce(conversion)
    expect(trackPurchaseOnce(conversion)).toBe(false)

    expect(window.dataLayer).toHaveLength(1)
  })

  it('tracks different payment intents separately', () => {
    trackPurchaseOnce(conversion)
    trackPurchaseOnce({ ...conversion, transactionId: 'pi_456' })

    expect(window.dataLayer?.map((e) => e.transaction_id)).toEqual(['pi_123', 'pi_456'])
  })

  it('omits user_data when no email hash is available', () => {
    trackPurchaseOnce({ ...conversion, emailSha256: null })

    expect(window.dataLayer?.[0]).not.toHaveProperty('user_data')
  })

  it('preserves events already queued before GTM loads', () => {
    window.dataLayer = [{ event: 'gtm.js' }]
    trackPurchaseOnce(conversion)

    expect(window.dataLayer.map((e) => e.event)).toEqual(['gtm.js', PURCHASE_EVENT])
  })

  it('still pushes when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })

    expect(trackPurchaseOnce(conversion)).toBe(true)
    expect(window.dataLayer).toHaveLength(1)
  })

  it('ignores an empty transaction id', () => {
    expect(trackPurchaseOnce({ ...conversion, transactionId: '' })).toBe(false)
    expect(window.dataLayer).toBeUndefined()
  })
})

describe('normalizeEmailForConversions', () => {
  it('trims and lowercases non-Gmail addresses without touching periods or plus suffixes', () => {
    expect(normalizeEmailForConversions('  User.Name+NYC@Example.com ')).toBe(
      'user.name+nyc@example.com'
    )
  })

  it('removes periods and plus suffixes from Gmail and Googlemail usernames', () => {
    expect(normalizeEmailForConversions('Jane.Doe+Shopping@googlemail.com')).toBe(
      'janedoe@googlemail.com'
    )
    expect(normalizeEmailForConversions('j.o.h.n+notes@Gmail.com')).toBe('john@gmail.com')
  })
})
