import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Stripe using vi.hoisted
const { mockRetrieve } = vi.hoisted(() => ({
  mockRetrieve: vi.fn(),
}))

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      paymentIntents: any
      constructor() {
        this.paymentIntents = {
          retrieve: mockRetrieve,
        }
      }
    },
  }
})

// Import after mock
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
    })
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

  it('should not expose error details in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockRetrieve.mockRejectedValue(new Error('Sensitive error details'))

    const request = new NextRequest('http://localhost:3000/api/verify-payment', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId: 'pi_mock' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(consoleSpy).not.toHaveBeenCalled()
    expect(data.error).toBe('Invalid payment intent')
    expect(data.error).not.toContain('Sensitive')

    process.env.NODE_ENV = originalNodeEnv
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
