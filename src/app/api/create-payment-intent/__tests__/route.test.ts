import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FormData } from '@/lib/form-storage'

// Mock Prisma using vi.hoisted
const { mockPrismaCreate, mockPrismaCancel } = vi.hoisted(() => ({
  mockPrismaCreate: vi.fn(),
  mockPrismaCancel: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    temporarySubmission: {
      create: mockPrismaCreate,
    },
  },
}))

// Mock Stripe using vi.hoisted
const { mockPaymentIntentCreate, mockPaymentIntentCancel } = vi.hoisted(() => ({
  mockPaymentIntentCreate: vi.fn(),
  mockPaymentIntentCancel: vi.fn(),
}))

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      paymentIntents: {
        create: typeof mockPaymentIntentCreate
        cancel: typeof mockPaymentIntentCancel
      }
      constructor() {
        this.paymentIntents = {
          create: mockPaymentIntentCreate,
          cancel: mockPaymentIntentCancel,
        }
      }
    },
  }
})

// Import after mocks
import { POST } from '../route'

describe('POST /api/create-payment-intent', () => {
  let originalEnv: NodeJS.ProcessEnv
  const mockFormData: FormData = {
    state: 'CA',
    recipient: 'myself',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDateOfBirth: '1990-01-01',
    email: 'john@example.com',
    phone: '5551234567',
    notePurpose: 'work',
    firstDayOff: '2025-01-20',
    lastDayOff: '2025-01-22',
    absenceReason: 'illness',
  }

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key'
    process.env.NEXT_PUBLIC_PAYMENT_AMOUNT = '2495'
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should create a payment intent and temporary submission successfully', async () => {
    const mockClientSecret = 'pi_mock_client_secret'
    const mockPaymentIntentId = 'pi_123456'

    mockPaymentIntentCreate.mockResolvedValue({
      id: mockPaymentIntentId,
      client_secret: mockClientSecret,
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockResolvedValue({
      id: 'temp_123',
      paymentIntentId: mockPaymentIntentId,
      formData: mockFormData,
      expiresAt: new Date(),
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      clientSecret: mockClientSecret,
    })
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: {
        paymentIntentId: mockPaymentIntentId,
        formData: mockFormData,
        expiresAt: expect.any(Date),
      },
    })
  })

  it('should return 400 if formData is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Form data is required')
  })

  it('should return 400 if required fields are missing', async () => {
    const incompleteFormData = {
      state: 'CA',
      recipient: 'myself',
      // Missing other required fields
    }

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: incompleteFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Missing required fields')
  })

  it('should validate guardian fields when recipient is someone_else', async () => {
    const formDataWithoutGuardian = {
      ...mockFormData,
      recipient: 'someone_else',
      // Missing guardian fields
    }

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: formDataWithoutGuardian }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Guardian information is required')
  })

  it('should call Stripe with correct parameters', async () => {
    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockPaymentIntentCreate).toHaveBeenCalledWith({
      amount: 2495,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      description: "Doctor's Note - Online Medical Documentation",
      metadata: {
        product: 'doctors-note',
        service: 'online-doctors-note',
        email: mockFormData.email,
      },
    })
  })

  it('should use payment amount from env variable (set at module load)', async () => {
    // Note: PAYMENT_AMOUNT is evaluated at module load time
    // This test verifies it's using the env var set in beforeEach (2495)
    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2495,
      })
    )
  })

  it('should use default payment amount if env variable not set', async () => {
    delete process.env.NEXT_PUBLIC_PAYMENT_AMOUNT

    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2495,
      })
    )
  })

  it('should include correct metadata in payment intent', async () => {
    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          product: 'doctors-note',
          service: 'online-doctors-note',
          email: mockFormData.email,
        },
      })
    )
  })

  it('should handle Stripe API errors', async () => {
    mockPaymentIntentCreate.mockRejectedValue(new Error('Stripe API error'))

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Payment processing error. Please try again.')
  })

  it('should cancel payment intent if database fails', async () => {
    const mockPaymentIntentId = 'pi_123456'

    mockPaymentIntentCreate.mockResolvedValue({
      id: mockPaymentIntentId,
      client_secret: 'pi_mock_secret',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockRejectedValue(new Error('Database error'))
    mockPaymentIntentCancel.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Unable to process your request. Please try again.')
    expect(mockPaymentIntentCancel).toHaveBeenCalledWith(mockPaymentIntentId)
  })

  it('should handle invalid Stripe key error', async () => {
    mockPaymentIntentCreate.mockRejectedValue(new Error('Invalid API Key provided'))

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Payment processing error. Please try again.')
  })

  it('should handle network errors', async () => {
    mockPaymentIntentCreate.mockRejectedValue(new Error('Network error'))

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)

    expect(response.status).toBe(500)
  })

  it('should use USD currency', async () => {
    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'usd',
      })
    )
  })

  it('should enable automatic payment methods', async () => {
    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_payment_methods: {
          enabled: true,
        },
      })
    )
  })

  it('should include description for payment intent', async () => {
    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Doctor's Note - Online Medical Documentation",
      })
    )
  })

  it('should return JSON response', async () => {
    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)

    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('should set expiry time to 24 hours', async () => {
    const now = Date.now()

    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    const createCall = mockPrismaCreate.mock.calls[0][0]
    const expiresAt = createCall.data.expiresAt.getTime()
    const expectedExpiry = now + 24 * 60 * 60 * 1000

    // Allow 1 second variance for test execution time
    expect(Math.abs(expiresAt - expectedExpiry)).toBeLessThan(1000)
  })

  it('should handle database connection errors gracefully', async () => {
    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaCreate.mockRejectedValue(new Error('Connection timeout'))
    mockPaymentIntentCancel.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Unable to process your request. Please try again.')
  })
})
