import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockRetrieve } = vi.hoisted(() => ({
  mockRetrieve: vi.fn(),
}))

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      paymentIntents: {
        retrieve: typeof mockRetrieve
      }
      constructor() {
        this.paymentIntents = {
          retrieve: mockRetrieve,
        }
      }
    },
  }
})

import { POST } from '../route'

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

  it('should verify a succeeded payment', async () => {
    const mockPaymentIntentId = 'pi_mock_123'
    mockRetrieve.mockResolvedValue({
      id: mockPaymentIntentId,
      status: 'succeeded',
      amount: 2999,
      metadata: { email: 'test@example.com' },
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: mockPaymentIntentId }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      status: 'succeeded',
      amount: 2999,
      currency: null,
      email: 'test@example.com',
      emailSha256: '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b',
    })
  })

  it('should return currency and hash a normalized email for enhanced conversions', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'succeeded',
      amount: 2495,
      currency: 'usd',
      metadata: { email: '  Test@Example.COM ' },
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.currency).toBe('usd')
    expect(data.emailSha256).toBe(
      '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b'
    )
  })

  it('should hash Gmail addresses after removing periods and plus suffixes', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'succeeded',
      amount: 2495,
      currency: 'usd',
      metadata: { email: 'Jane.Doe+Shopping@googlemail.com' },
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.email).toBe('Jane.Doe+Shopping@googlemail.com')
    expect(data.emailSha256).toBe(
      '338abf9ef1c8793cadc7bcf51ed595338eb727ed9e06ce3d91d566d60b975937'
    )
  })

  it('should return null email when metadata is missing', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'succeeded',
      amount: 2999,
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.email).toBeNull()
    expect(data.emailSha256).toBeNull()
  })

  it('should return null email when metadata.email is empty', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'succeeded',
      amount: 2999,
      metadata: { email: '' },
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.email).toBeNull()
  })

  it('should call Stripe retrieve with payment intent ID', async () => {
    const mockPaymentIntentId = 'pi_test_456'
    mockRetrieve.mockResolvedValue({
      id: mockPaymentIntentId,
      status: 'succeeded',
      amount: 2999,
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: mockPaymentIntentId }),
    })

    await POST(request)

    expect(mockRetrieve).toHaveBeenCalledWith(mockPaymentIntentId)
  })

  it('should handle payment with processing status', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'processing',
      amount: 2999,
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.status).toBe('processing')
  })

  it('should handle payment with requires_payment_method status', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'requires_payment_method',
      amount: 2999,
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.status).toBe('requires_payment_method')
  })

  it('should handle canceled payment', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'canceled',
      amount: 2999,
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.status).toBe('canceled')
  })

  it('should return 400 if payment intent ID is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Payment intent ID is required')
  })

  it('should return 400 if payment intent ID is null', async () => {
    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: null }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Payment intent ID is required')
  })

  it('should return 400 if payment intent ID is empty string', async () => {
    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: '' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Payment intent ID is required')
  })

  it('should handle invalid payment intent ID', async () => {
    mockRetrieve.mockRejectedValue(new Error('No such payment_intent'))

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'invalid_id' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid payment intent')
  })

  it('should handle Stripe API errors', async () => {
    mockRetrieve.mockRejectedValue(new Error('Stripe API error'))

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid payment intent')
  })

  it('should handle network errors', async () => {
    mockRetrieve.mockRejectedValue(new Error('Network error'))

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('should return correct amount from payment intent', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'succeeded',
      amount: 4999,
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.amount).toBe(4999)
  })

  it('should return JSON response', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'succeeded',
      amount: 2999,
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)

    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('does not expose Stripe error details in the response', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRetrieve.mockRejectedValue(new Error('Sensitive error details'))

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(consoleSpy).toHaveBeenCalledWith('Error verifying payment:', expect.any(Error))
    expect(data.error).toBe('Invalid payment intent')
    expect(JSON.stringify(data)).not.toContain('Sensitive')

    consoleSpy.mockRestore()
  })

  it('should handle malformed JSON in request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: 'invalid-json',
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('should handle payment intent with different amounts', async () => {
    const amounts = [1000, 2999, 5000, 10000]

    for (const amount of amounts) {
      mockRetrieve.mockResolvedValue({
        id: 'pi_mock',
        status: 'succeeded',
        amount,
      })

      const request = new NextRequest('http://localhost:3000/api/verify-payment', {
        method: 'POST',
        body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.amount).toBe(amount)
    }
  })

  it('should handle requires_action status', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'requires_action',
      amount: 2999,
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.status).toBe('requires_action')
  })

  it('should handle requires_confirmation status', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'requires_confirmation',
      amount: 2999,
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.status).toBe('requires_confirmation')
  })

  it('should only retrieve payment intent once per request', async () => {
    mockRetrieve.mockResolvedValue({
      id: 'pi_mock',
      status: 'succeeded',
      amount: 2999,
    })

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    await POST(request)

    expect(mockRetrieve).toHaveBeenCalledTimes(1)
  })
})
