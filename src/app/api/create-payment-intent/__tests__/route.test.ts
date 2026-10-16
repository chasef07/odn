import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FormData } from '@/lib/form-storage'

const { mockPrismaCreate, mockPrismaUpdate, mockPrismaDelete } = vi.hoisted(() => ({
  mockPrismaCreate: vi.fn(),
  mockPrismaUpdate: vi.fn(),
  mockPrismaDelete: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    temporarySubmission: {
      create: mockPrismaCreate,
      update: mockPrismaUpdate,
      delete: mockPrismaDelete,
    },
  },
}))

const { mockPaymentIntentCreate, mockPaymentIntentCancel, mockPricesRetrieve } = vi.hoisted(() => ({
  mockPaymentIntentCreate: vi.fn(),
  mockPaymentIntentCancel: vi.fn(),
  mockPricesRetrieve: vi.fn(),
}))

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}))

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      paymentIntents: {
        create: typeof mockPaymentIntentCreate
        cancel: typeof mockPaymentIntentCancel
      }
      prices: {
        retrieve: typeof mockPricesRetrieve
      }
      constructor() {
        this.paymentIntents = {
          create: mockPaymentIntentCreate,
          cancel: mockPaymentIntentCancel,
        }
        this.prices = {
          retrieve: mockPricesRetrieve,
        }
      }
    },
  }
})

import { POST } from '../route'
import { serializeAttributionCookie } from '@/lib/attribution'

describe('POST /api/create-payment-intent', () => {
  let originalEnv: NodeJS.ProcessEnv

  const _now = new Date()
  const _toISODate = (d: Date) => d.toISOString().split('T')[0]
  const _daysFromToday = (n: number) => {
    const d = new Date(_now)
    d.setUTCDate(d.getUTCDate() + n)
    return _toISODate(d)
  }

  const mockFormData: FormData = {
    state: 'California',
    recipient: 'myself',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDateOfBirth: '1990-01-01',
    email: 'john@example.com',
    phone: '5551234567',
    smsOptIn: true,
    notePurpose: 'work',
    firstDayOff: _daysFromToday(-1),
    lastDayOff: _daysFromToday(1),
    absenceReason: 'Feeling sick',
    symptoms: ['Fever or chills'],
  }

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key'
    process.env.STRIPE_PRICE_ID = 'price_test_mock'
    process.env.STRIPE_FRIENDS_FAMILY_PRICE_ID = 'price_friends_family_mock'
    process.env.STRIPE_DOCTOR_10_PRICE_ID = 'price_doctor_10_mock'
    process.env.INTAKE_VALIDATION_ENFORCED = 'true'
    vi.clearAllMocks()

    mockPricesRetrieve.mockImplementation(async (priceId: string) => {
      return {
        id: priceId,
        unit_amount:
          priceId === 'price_friends_family_mock'
            ? 2000
            : priceId === 'price_doctor_10_mock'
              ? 2246
              : 2495,
        currency: 'usd',
      }
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should create a payment intent and temporary submission successfully', async () => {
    const mockClientSecret = 'pi_mock_client_secret'
    const mockPaymentIntentId = 'pi_123456'
    const mockTempSubmissionId = 'temp_123'

    mockPrismaCreate.mockResolvedValue({
      id: mockTempSubmissionId,
      paymentIntentId: expect.stringMatching(/^pending_/),
      formData: mockFormData,
      expiresAt: new Date(),
    })

    mockPaymentIntentCreate.mockResolvedValue({
      id: mockPaymentIntentId,
      client_secret: mockClientSecret,
      amount: 2495,
      currency: 'usd',
      metadata: {
        temporarySubmissionId: mockTempSubmissionId,
      },
    })

    mockPrismaUpdate.mockResolvedValue({
      id: mockTempSubmissionId,
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
    expect(data).toEqual(
      expect.objectContaining({
        clientSecret: mockClientSecret,
        amount: 2495,
        currency: 'usd',
        priceId: 'price_test_mock',
        formattedAmount: '24.95',
        offerApplied: false,
        offerCode: null,
      })
    )

    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: {
        paymentIntentId: expect.stringMatching(/^pending_/),
        formData: mockFormData,
        expiresAt: expect.any(Date),
      },
    })

    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          temporarySubmissionId: mockTempSubmissionId,
        }),
      })
    )

    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: mockTempSubmissionId },
      data: {
        paymentIntentId: mockPaymentIntentId,
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
      state: 'California',
      recipient: 'myself',
    }

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: incompleteFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('First name is required')
  })

  it('should validate guardian fields when recipient is someone_else', async () => {
    const formDataWithoutGuardian = {
      ...mockFormData,
      recipient: 'someone_else',
    }

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: formDataWithoutGuardian }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Guardian first name is required')
  })

  describe('log-only mode', () => {
    beforeEach(() => {
      process.env.INTAKE_VALIDATION_ENFORCED = 'false'
      mockPrismaCreate.mockResolvedValue({ id: 'temp_shadow' })
      mockPaymentIntentCreate.mockResolvedValue({
        id: 'pi_shadow',
        client_secret: 'pi_shadow_secret',
        amount: 2495,
        currency: 'usd',
      })
      mockPrismaUpdate.mockResolvedValue({})
    })

    it('is the default when INTAKE_VALIDATION_ENFORCED is unset', async () => {
      delete process.env.INTAKE_VALIDATION_ENFORCED
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const response = await POST(
        new NextRequest('http://localhost:3000/api/create-payment-intent', {
          method: 'POST',
          body: JSON.stringify({ formData: { ...mockFormData, state: 'CA' } }),
          headers: { 'Content-Type': 'application/json' },
        })
      )

      expect(response.status).toBe(200)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Intake failed validation rules',
        expect.objectContaining({ enforced: false })
      )
      consoleWarn.mockRestore()
    })

    it('logs a rule failure with its field and lets the payment proceed', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const response = await POST(
        new NextRequest('http://localhost:3000/api/create-payment-intent', {
          method: 'POST',
          body: JSON.stringify({ formData: { ...mockFormData, notePurpose: 'legal' } }),
          headers: { 'Content-Type': 'application/json' },
        })
      )

      expect(response.status).toBe(200)
      expect(mockPaymentIntentCreate).toHaveBeenCalledTimes(1)
      expect(consoleWarn).toHaveBeenCalledWith('Intake failed validation rules', {
        enforced: false,
        issues: [
          {
            field: 'notePurpose',
            message: expect.stringMatching(/legal matters/),
            route: '/note-purpose',
          },
        ],
      })
      consoleWarn.mockRestore()
    })

    it('still rejects data that could not be persisted after payment', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const response = await POST(
        new NextRequest('http://localhost:3000/api/create-payment-intent', {
          method: 'POST',
          body: JSON.stringify({ formData: { ...mockFormData, phone: 5551234567 } }),
          headers: { 'Content-Type': 'application/json' },
        })
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Phone number is required')
      expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledWith(
        'Intake rejected before payment: data cannot be persisted',
        expect.objectContaining({
          issues: expect.arrayContaining([expect.objectContaining({ field: 'phone' })]),
        })
      )
      consoleWarn.mockRestore()
    })

    it('fails loudly when INTAKE_VALIDATION_ENFORCED is not true or false', async () => {
      process.env.INTAKE_VALIDATION_ENFORCED = 'shadow'
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST(
        new NextRequest('http://localhost:3000/api/create-payment-intent', {
          method: 'POST',
          body: JSON.stringify({ formData: { ...mockFormData, state: 'CA' } }),
          headers: { 'Content-Type': 'application/json' },
        })
      )

      expect(response.status).toBe(500)
      expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
    })

    it('accepts an accented name, a .es email, and a +1 phone', async () => {
      const response = await POST(
        new NextRequest('http://localhost:3000/api/create-payment-intent', {
          method: 'POST',
          body: JSON.stringify({
            formData: {
              ...mockFormData,
              patientFirstName: 'José',
              patientLastName: 'Muñoz',
              email: 'jose@correo.es',
              phone: '+1 555 123 4567',
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      )

      expect(response.status).toBe(200)
      expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ email: 'jose@correo.es' }) })
      )
    })
  })

  it('should call Stripe with correct parameters', async () => {
    const mockTempSubmissionId = 'temp_456'

    mockPrismaCreate.mockResolvedValue({
      id: mockTempSubmissionId,
    })

    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaUpdate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockPricesRetrieve).toHaveBeenCalledWith('price_test_mock')
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
        price_id: 'price_test_mock',
        price_type: 'standard',
        offer_code: '',
        offer_price_id: '',
        temporarySubmissionId: mockTempSubmissionId,
      },
    })
  })

  it('should use friends and family price when friends20 offer is supplied', async () => {
    const mockTempSubmissionId = 'temp_friends'

    mockPrismaCreate.mockResolvedValue({
      id: mockTempSubmissionId,
    })

    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_friends',
      client_secret: 'pi_friends_secret',
      amount: 2000,
      currency: 'usd',
    })

    mockPrismaUpdate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: { ...mockFormData, offerCode: 'friends20' } }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockPricesRetrieve).toHaveBeenCalledWith('price_friends_family_mock')
    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2000,
        metadata: expect.objectContaining({
          price_id: 'price_friends_family_mock',
          price_type: 'friends_family',
          offer_code: 'friends20',
          offer_price_id: 'price_friends_family_mock',
          temporarySubmissionId: mockTempSubmissionId,
        }),
      })
    )
    expect(data).toEqual(
      expect.objectContaining({
        amount: 2000,
        formattedAmount: '20.00',
        priceId: 'price_friends_family_mock',
        offerApplied: true,
        offerCode: 'friends20',
      })
    )
  })

  it('should use doctor price when doctor10 offer is supplied', async () => {
    const mockTempSubmissionId = 'temp_doctor_10'

    mockPrismaCreate.mockResolvedValue({
      id: mockTempSubmissionId,
    })

    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_doctor_10',
      client_secret: 'pi_doctor_10_secret',
      amount: 2246,
      currency: 'usd',
    })

    mockPrismaUpdate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: { ...mockFormData, offerCode: 'doctor10' } }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockPricesRetrieve).toHaveBeenCalledWith('price_doctor_10_mock')
    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2246,
        metadata: expect.objectContaining({
          price_id: 'price_doctor_10_mock',
          price_type: 'doctor_10',
          offer_code: 'doctor10',
          offer_price_id: 'price_doctor_10_mock',
          temporarySubmissionId: mockTempSubmissionId,
        }),
      })
    )
    expect(data).toEqual(
      expect.objectContaining({
        amount: 2246,
        formattedAmount: '22.46',
        priceId: 'price_doctor_10_mock',
        offerApplied: true,
        offerCode: 'doctor10',
      })
    )
  })

  it('should fall back to standard price when offer is invalid', async () => {
    mockPrismaCreate.mockResolvedValue({ id: 'temp_invalid_offer' })

    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_standard',
      client_secret: 'pi_standard_secret',
      amount: 2495,
      currency: 'usd',
    })

    mockPrismaUpdate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData, offerCode: 'not-real' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockPricesRetrieve).toHaveBeenCalledWith('price_test_mock')
    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2495,
        metadata: expect.objectContaining({
          price_id: 'price_test_mock',
          price_type: 'standard',
          offer_code: '',
          offer_price_id: '',
        }),
      })
    )
    expect(data).toEqual(
      expect.objectContaining({
        amount: 2495,
        priceId: 'price_test_mock',
        offerApplied: false,
        offerCode: null,
      })
    )
  })

  it('should return an error when friends and family price is not configured', async () => {
    delete process.env.STRIPE_FRIENDS_FAMILY_PRICE_ID
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData, offerCode: 'friends20' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Friends and family offer is not configured. Please contact support.')
    expect(mockPricesRetrieve).not.toHaveBeenCalled()
    expect(mockPrismaCreate).not.toHaveBeenCalled()
    expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      'Friends and family offer requested but STRIPE_FRIENDS_FAMILY_PRICE_ID is unset'
    )

    consoleError.mockRestore()
  })

  it('should return an error when doctor price is not configured', async () => {
    delete process.env.STRIPE_DOCTOR_10_PRICE_ID
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData, offerCode: 'doctor10' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Doctor offer is not configured. Please contact support.')
    expect(mockPricesRetrieve).not.toHaveBeenCalled()
    expect(mockPrismaCreate).not.toHaveBeenCalled()
    expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      'Doctor offer requested but STRIPE_DOCTOR_10_PRICE_ID is unset'
    )

    consoleError.mockRestore()
  })

  it('should fetch price from Stripe before creating payment intent', async () => {
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

    expect(mockPricesRetrieve).toHaveBeenCalledWith('price_test_mock')
    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2495,
        currency: 'usd',
      })
    )
  })

  it('should use amount from Stripe Price object', async () => {
    mockPricesRetrieve.mockResolvedValue({
      id: 'price_test_mock',
      unit_amount: 3999,
      currency: 'usd',
    })

    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 3999,
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
        amount: 3999,
      })
    )
  })

  it('should handle Stripe price fetch errors', async () => {
    mockPricesRetrieve.mockRejectedValue(new Error('Price not found'))

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Unable to fetch pricing information. Please try again.')
    expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
  })

  it('should handle invalid price object (missing unit_amount)', async () => {
    mockPricesRetrieve.mockResolvedValue({
      id: 'price_test_mock',
      unit_amount: null,
      currency: 'usd',
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Invalid pricing configuration. Please contact support.')
    expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
  })

  it('should handle invalid price object (missing currency)', async () => {
    mockPricesRetrieve.mockResolvedValue({
      id: 'price_test_mock',
      unit_amount: 2495,
      currency: null,
    })

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Invalid pricing configuration. Please contact support.')
    expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
  })

  it('should include correct metadata in payment intent including price_id', async () => {
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
        metadata: expect.objectContaining({
          product: 'doctors-note',
          service: 'online-doctors-note',
          email: mockFormData.email,
          price_id: 'price_test_mock',
          price_type: 'standard',
          offer_code: '',
          offer_price_id: '',
        }),
      })
    )
  })

  it('stores attribution from the first-party cookie and ignores attribution in the body', async () => {
    const attribution = {
      first: {
        channel: 'reddit',
        source: 'reddit',
        medium: 'paid',
        campaign: 'fall_promo',
        content: null,
        term: null,
        clickIds: { rdt_cid: 'r1' },
        referrer: null,
        landingPath: '/',
        at: '2026-10-07T12:00:00.000Z',
      },
      last: {
        channel: 'reddit',
        source: 'reddit',
        medium: 'paid',
        campaign: '20%off',
        content: null,
        term: null,
        clickIds: { rdt_cid: 'r1' },
        referrer: null,
        landingPath: '/',
        at: '2026-10-07T12:00:00.000Z',
      },
    } as const
    mockPrismaCreate.mockResolvedValue({ id: 'temp_attr' })
    mockPaymentIntentCreate.mockResolvedValue({ id: 'pi_attr', client_secret: 'secret' })
    mockPrismaUpdate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({
        formData: { ...mockFormData, attribution: { spoofed: true } },
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: `odn_attr=${serializeAttributionCookie(attribution)!}`,
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockPrismaCreate.mock.calls[0][0].data.formData).toEqual({
      ...mockFormData,
      attribution,
    })
    expect(mockPaymentIntentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          attr_channel: 'reddit',
          attr_source: 'reddit',
          attr_medium: 'paid',
          attr_campaign: '20%off',
          attr_first_channel: 'reddit',
        }),
      })
    )
  })

  it('drops client-supplied attribution when there is no cookie', async () => {
    mockPrismaCreate.mockResolvedValue({ id: 'temp_no_attr' })
    mockPaymentIntentCreate.mockResolvedValue({ id: 'pi_no_attr', client_secret: 'secret' })
    mockPrismaUpdate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: { ...mockFormData, attribution: { spoofed: true } } }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockPrismaCreate.mock.calls[0][0].data.formData).toEqual(mockFormData)
    expect(mockPaymentIntentCreate.mock.calls[0][0].metadata).not.toHaveProperty('attr_channel')
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

  it('should return 500 if database fails to create TemporarySubmission', async () => {
    mockPrismaCreate.mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Unable to process your request. Please try again.')

    expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
    expect(mockPaymentIntentCancel).not.toHaveBeenCalled()
  })

  it('should handle invalid Stripe key error', async () => {
    const mockTempSubmissionId = 'temp_789'

    mockPrismaCreate.mockResolvedValue({
      id: mockTempSubmissionId,
    })

    mockPaymentIntentCreate.mockRejectedValue(new Error('Invalid API Key provided'))

    mockPrismaDelete.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Payment processing error. Please try again.')

    expect(mockPrismaDelete).toHaveBeenCalledWith({
      where: { id: mockTempSubmissionId },
    })
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

  it('should use currency from Stripe Price object', async () => {
    mockPricesRetrieve.mockResolvedValue({
      id: 'price_test_mock',
      unit_amount: 2495,
      currency: 'eur',
    })

    mockPaymentIntentCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_mock',
      amount: 2495,
      currency: 'eur',
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
        currency: 'eur',
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

  describe('server-side validation hardening', () => {
    const today = new Date()
    const toISODate = (d: Date) => d.toISOString().split('T')[0]
    const daysFromToday = (n: number) => {
      const d = new Date(today)
      d.setUTCDate(d.getUTCDate() + n)
      return toISODate(d)
    }

    it('should reject absences longer than 7 days', async () => {
      const badData = {
        ...mockFormData,
        firstDayOff: daysFromToday(0),
        lastDayOff: daysFromToday(10),
      }

      const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/7 consecutive days/i)
      expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
    })

    it('should reject firstDayOff more than 7 days in the past', async () => {
      const badData = {
        ...mockFormData,
        firstDayOff: daysFromToday(-30),
        lastDayOff: daysFromToday(-30),
      }

      const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/7 days in the past/i)
      expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
    })

    it('should reject lastDayOff before firstDayOff', async () => {
      const badData = {
        ...mockFormData,
        firstDayOff: daysFromToday(2),
        lastDayOff: daysFromToday(1),
      }

      const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/on or after first day off/i)
      expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
    })

    it('should reject a patient DOB in the future (recipient=someone_else)', async () => {
      const badData = {
        ...mockFormData,
        recipient: 'someone_else',
        patientDateOfBirth: daysFromToday(30),
        guardianFirstName: 'Jane',
        guardianLastName: 'Doe',
        guardianDateOfBirth: '1980-01-01',
      }

      const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/cannot be in the future/i)
      expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
    })

    it('should reject a patient DOB before 1900 (recipient=someone_else)', async () => {
      const badData = {
        ...mockFormData,
        recipient: 'someone_else',
        patientDateOfBirth: '1850-01-01',
        guardianFirstName: 'Jane',
        guardianLastName: 'Doe',
        guardianDateOfBirth: '1980-01-01',
      }

      const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/valid date of birth/i)
      expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
    })

    it('should reject under-18 patient when recipient=myself', async () => {
      const dob = new Date(today)
      dob.setUTCFullYear(dob.getUTCFullYear() - 5)

      const badData = {
        ...mockFormData,
        recipient: 'myself',
        patientDateOfBirth: toISODate(dob),
      }

      const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/18 or older/i)
      expect(mockPaymentIntentCreate).not.toHaveBeenCalled()
    })

    it('should accept valid dates within limits', async () => {
      mockPrismaCreate.mockResolvedValue({ id: 'temp_valid' })
      mockPaymentIntentCreate.mockResolvedValue({
        id: 'pi_valid',
        client_secret: 'pi_valid_secret',
        amount: 2495,
        currency: 'usd',
      })
      mockPrismaUpdate.mockResolvedValue({})

      const goodData = {
        ...mockFormData,
        firstDayOff: daysFromToday(-2),
        lastDayOff: daysFromToday(2),
      }

      const request = new NextRequest('http://localhost:3000/api/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({ formData: goodData }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(mockPaymentIntentCreate).toHaveBeenCalled()
    })
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
