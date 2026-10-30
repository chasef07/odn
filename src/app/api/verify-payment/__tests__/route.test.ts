import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockRetrieve } = vi.hoisted(() => ({
  mockRetrieve: vi.fn(),
}))

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      checkout = { sessions: { retrieve: mockRetrieve } }
    },
  }
})

import { POST } from '../route'

const paidSession = {
  id: 'cs_test_123',
  status: 'complete',
  payment_status: 'paid',
  payment_intent: 'pi_test_123',
  amount_total: 2995,
  currency: 'usd',
  customer_email: 'test@example.com',
}

function verify(body: unknown) {
  return POST(
    new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  )
}

describe('POST /api/verify-payment', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key'
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('reports a paid Checkout Session with its payment intent, amount and hashed email', async () => {
    mockRetrieve.mockResolvedValue(paidSession)

    const response = await verify({ sessionId: 'cs_test_123' })

    expect(response.status).toBe(200)
    expect(mockRetrieve).toHaveBeenCalledOnce()
    expect(mockRetrieve).toHaveBeenCalledWith('cs_test_123')
    expect(await response.json()).toEqual({
      status: 'paid',
      paymentIntentId: 'pi_test_123',
      amount: 2995,
      currency: 'usd',
      email: 'test@example.com',
      emailSha256: '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b',
    })
  })

  it('hashes a normalized email for enhanced conversions', async () => {
    mockRetrieve.mockResolvedValue({ ...paidSession, customer_email: '  Test@Example.COM ' })

    const data = await (await verify({ sessionId: 'cs_test_123' })).json()

    expect(data.emailSha256).toBe(
      '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b'
    )
  })

  it('hashes Gmail addresses after removing periods and plus suffixes', async () => {
    mockRetrieve.mockResolvedValue({
      ...paidSession,
      customer_email: 'Jane.Doe+Shopping@googlemail.com',
    })

    const data = await (await verify({ sessionId: 'cs_test_123' })).json()

    expect(data.email).toBe('Jane.Doe+Shopping@googlemail.com')
    expect(data.emailSha256).toBe(
      '338abf9ef1c8793cadc7bcf51ed595338eb727ed9e06ce3d91d566d60b975937'
    )
  })

  it('returns a null email and hash when the session has no email', async () => {
    mockRetrieve.mockResolvedValue({ ...paidSession, customer_email: null })

    const data = await (await verify({ sessionId: 'cs_test_123' })).json()

    expect(data.email).toBeNull()
    expect(data.emailSha256).toBeNull()
  })

  it('reads the id of an expanded payment intent', async () => {
    mockRetrieve.mockResolvedValue({ ...paidSession, payment_intent: { id: 'pi_expanded' } })

    const data = await (await verify({ sessionId: 'cs_test_123' })).json()

    expect(data.paymentIntentId).toBe('pi_expanded')
  })

  it('reports processing for a completed session whose bank payment has not cleared', async () => {
    mockRetrieve.mockResolvedValue({ ...paidSession, payment_status: 'unpaid' })

    const data = await (await verify({ sessionId: 'cs_test_123' })).json()

    expect(data.status).toBe('processing')
    expect(data.paymentIntentId).toBe('pi_test_123')
  })

  it('reports open for a session the customer has not paid yet', async () => {
    mockRetrieve.mockResolvedValue({
      ...paidSession,
      status: 'open',
      payment_status: 'unpaid',
      payment_intent: null,
    })

    const data = await (await verify({ sessionId: 'cs_test_123' })).json()

    expect(data.status).toBe('open')
    expect(data.paymentIntentId).toBeNull()
  })

  it('reports expired for a session that timed out unpaid', async () => {
    mockRetrieve.mockResolvedValue({
      ...paidSession,
      status: 'expired',
      payment_status: 'unpaid',
      payment_intent: null,
    })

    const data = await (await verify({ sessionId: 'cs_test_123' })).json()

    expect(data.status).toBe('expired')
  })

  it.each([{}, { sessionId: null }, { sessionId: '' }])(
    'returns 400 without calling Stripe when the session id is missing (%j)',
    async (body) => {
      const response = await verify(body)

      expect(response.status).toBe(400)
      expect((await response.json()).error).toBe('Checkout Session ID is required')
      expect(mockRetrieve).not.toHaveBeenCalled()
    }
  )

  it('returns 400 without Stripe error details when Stripe refuses the session', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRetrieve.mockRejectedValue(new Error('Sensitive error details'))

    const response = await verify({ sessionId: 'cs_bad' })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(consoleSpy).toHaveBeenCalledWith('Error verifying payment:', expect.any(Error))
    expect(data.error).toBe('Invalid Checkout Session')
    expect(JSON.stringify(data)).not.toContain('Sensitive')
    consoleSpy.mockRestore()
  })

  it('returns 400 for a malformed JSON body', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await verify('invalid-json')

    expect(response.status).toBe(400)
    consoleSpy.mockRestore()
  })
})
