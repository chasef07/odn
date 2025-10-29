import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Stripe using vi.hoisted
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      paymentIntents: {
        create: typeof mockCreate
      }
      constructor() {
        this.paymentIntents = {
          create: mockCreate,
        }
      }
    },
  }
})

// Import after mock
import { POST } from '../route'

describe('POST /api/create-payment-intent', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key'
    process.env.NEXT_PUBLIC_PAYMENT_AMOUNT = '2999'
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should create a payment intent successfully', async () => {
    const mockClientSecret = 'pi_mock_client_secret'
    mockCreate.mockResolvedValue({
      client_secret: mockClientSecret,
      amount: 2999,
      currency: 'usd',
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      clientSecret: mockClientSecret,
      amount: 2999,
    })
  })

  it('should call Stripe with correct parameters', async () => {
    mockCreate.mockResolvedValue({
      client_secret: 'pi_mock',
      amount: 2999,
      currency: 'usd',
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    await POST(request)

    expect(mockCreate).toHaveBeenCalledWith({
      amount: 2999,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      description: "Doctor's Note - Online Medical Documentation",
      metadata: {
        product: 'doctors_note',
        service: 'online_medical_note',
      },
    })
  })

  it('should use custom payment amount from env variable', async () => {
    process.env.NEXT_PUBLIC_PAYMENT_AMOUNT = '4999'

    mockCreate.mockResolvedValue({
      client_secret: 'pi_mock',
      amount: 4999,
      currency: 'usd',
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4999,
      })
    )
    expect(data.amount).toBe(4999)
  })

  it('should use default payment amount if env variable not set', async () => {
    delete process.env.NEXT_PUBLIC_PAYMENT_AMOUNT

    mockCreate.mockResolvedValue({
      client_secret: 'pi_mock',
      amount: 2999,
      currency: 'usd',
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    await POST(request)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2999,
      })
    )
  })

  it('should include correct metadata in payment intent', async () => {
    mockCreate.mockResolvedValue({
      client_secret: 'pi_mock',
      amount: 2999,
      currency: 'usd',
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    await POST(request)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          product: 'doctors_note',
          service: 'online_medical_note',
        },
      })
    )
  })

  it('should handle Stripe API errors', async () => {
    mockCreate.mockRejectedValue(new Error('Stripe API error'))

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      error: 'Failed to create payment intent',
    })
  })

  it('should handle invalid Stripe key error', async () => {
    mockCreate.mockRejectedValue(new Error('Invalid API Key provided'))

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to create payment intent')
  })

  it('should handle network errors', async () => {
    mockCreate.mockRejectedValue(new Error('Network error'))

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    const response = await POST(request)

    expect(response.status).toBe(500)
  })

  it('should use USD currency', async () => {
    mockCreate.mockResolvedValue({
      client_secret: 'pi_mock',
      amount: 2999,
      currency: 'usd',
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    await POST(request)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'usd',
      })
    )
  })

  it('should enable automatic payment methods', async () => {
    mockCreate.mockResolvedValue({
      client_secret: 'pi_mock',
      amount: 2999,
      currency: 'usd',
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    await POST(request)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_payment_methods: {
          enabled: true,
        },
      })
    )
  })

  it('should include description for payment intent', async () => {
    mockCreate.mockResolvedValue({
      client_secret: 'pi_mock',
      amount: 2999,
      currency: 'usd',
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    await POST(request)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Doctor's Note - Online Medical Documentation",
      })
    )
  })

  it('should return JSON response', async () => {
    mockCreate.mockResolvedValue({
      client_secret: 'pi_mock',
      amount: 2999,
      currency: 'usd',
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    const response = await POST(request)

    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('should handle Stripe rate limit errors', async () => {
    const rateLimitError = new Error('Rate limit exceeded')
    mockCreate.mockRejectedValue(rateLimitError)

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    const response = await POST(request)

    expect(response.status).toBe(500)
  })

  it('should not expose error details in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockCreate.mockRejectedValue(new Error('Sensitive error'))

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
    })

    const response = await POST(request)
    const data = await response.json()

    expect(consoleSpy).not.toHaveBeenCalled()
    expect(data.error).toBe('Failed to create payment intent')
    expect(data.error).not.toContain('Sensitive')

    process.env.NODE_ENV = originalNodeEnv
    consoleSpy.mockRestore()
  })
})
