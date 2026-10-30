import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FormData } from '@/lib/form-storage'

const { mockCreateTemporarySubmission, mockDeleteTemporarySubmission } = vi.hoisted(() => ({
  mockCreateTemporarySubmission: vi.fn(),
  mockDeleteTemporarySubmission: vi.fn(),
}))

vi.mock('@/db/temporary-submissions', () => ({
  createTemporarySubmission: mockCreateTemporarySubmission,
  deleteTemporarySubmission: mockDeleteTemporarySubmission,
}))

const { mockSessionCreate } = vi.hoisted(() => ({
  mockSessionCreate: vi.fn(),
}))

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      checkout = { sessions: { create: mockSessionCreate } }
    },
  }
})

import { POST } from '../route'
import { serializeAttributionCookie } from '@/lib/attribution'

const ORIGIN = 'https://onlinedoctornote.com'

describe('POST /api/create-checkout-session', () => {
  let originalEnv: NodeJS.ProcessEnv

  const _now = new Date()
  const _toISODate = (d: Date) => d.toISOString().split('T')[0]
  const _daysFromToday = (n: number) => {
    const d = new Date(_now)
    d.setUTCDate(d.getUTCDate() + n)
    return _toISODate(d)
  }
  const _yearsAgo = (n: number) => {
    const d = new Date(_now)
    d.setUTCFullYear(d.getUTCFullYear() - n)
    return _toISODate(d)
  }
  const sessionArgs = () => mockSessionCreate.mock.calls[0][0]
  const post = (formData: unknown) =>
    POST(
      new NextRequest('http://localhost:3000/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ formData }),
        headers: { 'Content-Type': 'application/json', origin: ORIGIN },
      })
    )

  const mockFormData: FormData = {
    state: 'California',
    recipient: 'myself',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDateOfBirth: '1990-01-01',
    email: 'john@example.com',
    phone: '5551234567',
    smsOptIn: true,
    certifyAccurate: true,
    agreeTerms: true,
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
    mockSessionCreate.mockResolvedValue({ id: 'cs_test_123', client_secret: 'cs_test_secret' })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('saves the draft and creates an embedded Checkout Session for it', async () => {
    mockCreateTemporarySubmission.mockResolvedValue({ id: 'temp_123' })

    const response = await post(mockFormData)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ clientSecret: 'cs_test_secret' })
    expect(mockCreateTemporarySubmission).toHaveBeenCalledWith({
      formData: mockFormData,
      expiresAt: expect.any(Date),
    })
    expect(mockSessionCreate).toHaveBeenCalledWith({
      ui_mode: 'embedded',
      mode: 'payment',
      line_items: [{ price: 'price_test_mock', quantity: 1 }],
      customer_email: mockFormData.email,
      locale: 'en',
      return_url: `${ORIGIN}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      payment_intent_data: {
        description: "Doctor's Note - Online Medical Documentation",
        metadata: {
          product: 'doctors-note',
          service: 'online-doctors-note',
          email: mockFormData.email,
          price_id: 'price_test_mock',
          price_type: 'standard',
          offer_code: '',
          offer_price_id: '',
          temporarySubmissionId: 'temp_123',
        },
      },
    })
  })

  it('returns a Spanish customer to the Spanish success page in a Spanish Checkout', async () => {
    mockCreateTemporarySubmission.mockResolvedValue({ id: 'temp_es' })

    const response = await POST(
      new NextRequest('http://localhost:3000/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ formData: mockFormData, locale: 'es' }),
        headers: { 'Content-Type': 'application/json', origin: ORIGIN },
      })
    )

    expect(response.status).toBe(200)
    expect(sessionArgs().locale).toBe('es')
    expect(sessionArgs().return_url).toBe(
      `${ORIGIN}/es/payment/success?session_id={CHECKOUT_SESSION_ID}`
    )
  })

  it('refuses a request without an Origin header before saving anything', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ formData: mockFormData }),
        headers: { 'Content-Type': 'application/json' },
      })
    )

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('Origin header is required')
    expect(mockCreateTemporarySubmission).not.toHaveBeenCalled()
    expect(mockSessionCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['friends20', 'price_friends_family_mock', 'friends_family'],
    ['doctor10', 'price_doctor_10_mock', 'doctor_10'],
  ])('sells the %s offer price and records the offer', async (code, priceId, priceType) => {
    mockCreateTemporarySubmission.mockResolvedValue({ id: 'temp_offer' })

    const response = await post({ ...mockFormData, offerCode: code })

    expect(response.status).toBe(200)
    expect(sessionArgs().line_items).toEqual([{ price: priceId, quantity: 1 }])
    expect(sessionArgs().payment_intent_data.metadata).toEqual(
      expect.objectContaining({
        price_id: priceId,
        price_type: priceType,
        offer_code: code,
        offer_price_id: priceId,
        temporarySubmissionId: 'temp_offer',
      })
    )
  })

  it('sells the standard price when the offer code is unknown', async () => {
    mockCreateTemporarySubmission.mockResolvedValue({ id: 'temp_invalid_offer' })

    const response = await POST(
      new NextRequest('http://localhost:3000/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ formData: mockFormData, offerCode: 'not-real' }),
        headers: { 'Content-Type': 'application/json', origin: ORIGIN },
      })
    )

    expect(response.status).toBe(200)
    expect(sessionArgs().line_items).toEqual([{ price: 'price_test_mock', quantity: 1 }])
    expect(sessionArgs().payment_intent_data.metadata).toEqual(
      expect.objectContaining({ price_type: 'standard', offer_code: '', offer_price_id: '' })
    )
  })

  it('should return 400 if formData is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
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

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ formData: incompleteFormData }),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
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

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ formData: formDataWithoutGuardian }),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Guardian first name is required')
  })

  describe('log-only mode', () => {
    beforeEach(() => {
      process.env.INTAKE_VALIDATION_ENFORCED = 'false'
      mockCreateTemporarySubmission.mockResolvedValue({ id: 'temp_shadow' })
    })

    it('is the default when INTAKE_VALIDATION_ENFORCED is unset', async () => {
      delete process.env.INTAKE_VALIDATION_ENFORCED
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const response = await POST(
        new NextRequest('http://localhost:3000/api/create-checkout-session', {
          method: 'POST',
          body: JSON.stringify({ formData: { ...mockFormData, state: 'CA' } }),
          headers: { 'Content-Type': 'application/json', origin: ORIGIN },
        })
      )

      expect(response.status).toBe(200)
      expect(JSON.parse(consoleWarn.mock.calls[0][0])).toMatchObject({ enforced: false })
      consoleWarn.mockRestore()
    })

    it('still blocks every draft the server blocked before shadow mode', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const child = { recipient: 'someone_else', patientDateOfBirth: _yearsAgo(10) }
      const guardians = { ...child, guardianFirstName: 'Jane', guardianLastName: 'Doe' }
      const cases: Array<[Record<string, unknown>, string, RegExp]> = [
        [{ notePurpose: 'legal' }, '/note-purpose', /legal matters/],
        [{ patientDateOfBirth: _yearsAgo(17) }, '/basic-info', /18 or older/],
        [
          { firstDayOff: _daysFromToday(-12), lastDayOff: _daysFromToday(-11) },
          '/absence-dates',
          /7 days in the past/,
        ],
        [
          { firstDayOff: _daysFromToday(0), lastDayOff: _daysFromToday(9) },
          '/absence-dates',
          /7 consecutive days/,
        ],
        [child, '/guardian-info', /Guardian first name is required/],
        [guardians, '/guardian-info', /Date of birth is required/],
        [
          { ...guardians, guardianDateOfBirth: _yearsAgo(16) },
          '/guardian-info',
          /18 years or older/,
        ],
      ]
      for (const [patch, route, message] of cases) {
        mockSessionCreate.mockClear()
        const response = await post({ ...mockFormData, ...patch })
        const data = await response.json()
        expect(response.status, JSON.stringify(patch)).toBe(400)
        expect(data).toEqual({ error: expect.stringMatching(message), route })
        expect(mockSessionCreate).not.toHaveBeenCalled()
      }
    })

    it('lets a draft that breaks only a rule new to this change proceed', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const response = await post({ ...mockFormData, state: 'CA', email: 'john@gmail.con' })

      expect(response.status).toBe(200)
      expect(mockSessionCreate).toHaveBeenCalledTimes(1)
      expect(consoleWarn).toHaveBeenCalledTimes(1)
      consoleWarn.mockRestore()
    })

    it('logs one single-line JSON entry with rule codes and no message text', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await post({ ...mockFormData, state: 'CA', email: 'john@gmail.con' })

      expect(consoleWarn).toHaveBeenCalledTimes(1)
      const args = consoleWarn.mock.calls[0]
      expect(args).toHaveLength(1)
      const line = args[0]
      expect(typeof line).toBe('string')
      expect(line).not.toContain('\n')
      expect(JSON.parse(line)).toEqual({
        severity: 'WARNING',
        event: 'intake_rule_failure',
        endpoint: '/api/create-checkout-session',
        enforced: false,
        blocked: false,
        issues: [
          { rule: 'state_unsupported', field: 'state', route: '/get-started' },
          { rule: 'email_typo', field: 'email', route: '/contact-info' },
        ],
      })
      consoleWarn.mockRestore()
    })

    it('still rejects data that could not be persisted after payment', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const response = await POST(
        new NextRequest('http://localhost:3000/api/create-checkout-session', {
          method: 'POST',
          body: JSON.stringify({ formData: { ...mockFormData, phone: 5551234567 } }),
          headers: { 'Content-Type': 'application/json', origin: ORIGIN },
        })
      )
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Phone number is required')
      expect(mockSessionCreate).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledTimes(1)
      expect(JSON.parse(consoleWarn.mock.calls[0][0])).toEqual({
        severity: 'WARNING',
        event: 'intake_shape_failure',
        endpoint: '/api/create-checkout-session',
        issues: [{ rule: 'required', field: 'phone', route: '/contact-info' }],
      })
      consoleWarn.mockRestore()
    })

    it('fails loudly when INTAKE_VALIDATION_ENFORCED is not true or false', async () => {
      process.env.INTAKE_VALIDATION_ENFORCED = 'shadow'
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const response = await POST(
        new NextRequest('http://localhost:3000/api/create-checkout-session', {
          method: 'POST',
          body: JSON.stringify({ formData: { ...mockFormData, state: 'CA' } }),
          headers: { 'Content-Type': 'application/json', origin: ORIGIN },
        })
      )

      expect(response.status).toBe(500)
      expect(mockSessionCreate).not.toHaveBeenCalled()
    })

    it('accepts an accented name, a .es email, and a +1 phone', async () => {
      const response = await POST(
        new NextRequest('http://localhost:3000/api/create-checkout-session', {
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
          headers: { 'Content-Type': 'application/json', origin: ORIGIN },
        })
      )

      expect(response.status).toBe(200)
      expect(sessionArgs().customer_email).toBe('jose@correo.es')
      expect(sessionArgs().payment_intent_data.metadata.email).toBe('jose@correo.es')
    })
  })

  it('should return an error when friends and family price is not configured', async () => {
    delete process.env.STRIPE_FRIENDS_FAMILY_PRICE_ID
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData, offerCode: 'friends20' }),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Friends and family offer is not configured. Please contact support.')
    expect(mockCreateTemporarySubmission).not.toHaveBeenCalled()
    expect(mockSessionCreate).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      'Friends and family offer requested but STRIPE_FRIENDS_FAMILY_PRICE_ID is unset'
    )

    consoleError.mockRestore()
  })

  it('should return an error when doctor price is not configured', async () => {
    delete process.env.STRIPE_DOCTOR_10_PRICE_ID
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData, offerCode: 'doctor10' }),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Doctor offer is not configured. Please contact support.')
    expect(mockCreateTemporarySubmission).not.toHaveBeenCalled()
    expect(mockSessionCreate).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      'Doctor offer requested but STRIPE_DOCTOR_10_PRICE_ID is unset'
    )

    consoleError.mockRestore()
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
    mockCreateTemporarySubmission.mockResolvedValue({ id: 'temp_attr' })

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({
        formData: { ...mockFormData, attribution: { spoofed: true } },
      }),
      headers: {
        'Content-Type': 'application/json',
        origin: ORIGIN,
        cookie: `odn_attr=${serializeAttributionCookie(attribution)!}`,
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockCreateTemporarySubmission.mock.calls[0][0].formData).toEqual({
      ...mockFormData,
      attribution,
    })
    expect(sessionArgs().payment_intent_data.metadata).toEqual(
      expect.objectContaining({
        attr_channel: 'reddit',
        attr_source: 'reddit',
        attr_medium: 'paid',
        attr_campaign: '20%off',
        attr_first_channel: 'reddit',
      })
    )
  })

  it('drops client-supplied attribution when there is no cookie', async () => {
    mockCreateTemporarySubmission.mockResolvedValue({ id: 'temp_no_attr' })

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ formData: { ...mockFormData, attribution: { spoofed: true } } }),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
    })

    await POST(request)

    expect(mockCreateTemporarySubmission.mock.calls[0][0].formData).toEqual(mockFormData)
    expect(sessionArgs().payment_intent_data.metadata).not.toHaveProperty('attr_channel')
  })

  it('should handle Stripe API errors', async () => {
    mockSessionCreate.mockRejectedValue(new Error('Stripe API error'))

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Payment processing error. Please try again.')
  })

  it('should return 500 if database fails to create TemporarySubmission', async () => {
    mockCreateTemporarySubmission.mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Unable to process your request. Please try again.')

    expect(mockSessionCreate).not.toHaveBeenCalled()
  })

  it('should handle invalid Stripe key error', async () => {
    const mockTempSubmissionId = 'temp_789'

    mockCreateTemporarySubmission.mockResolvedValue({
      id: mockTempSubmissionId,
    })

    mockSessionCreate.mockRejectedValue(new Error('Invalid API Key provided'))

    mockDeleteTemporarySubmission.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Payment processing error. Please try again.')

    expect(mockDeleteTemporarySubmission).toHaveBeenCalledWith(mockTempSubmissionId)
  })

  it('should handle network errors', async () => {
    mockSessionCreate.mockRejectedValue(new Error('Network error'))

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
    })

    const response = await POST(request)

    expect(response.status).toBe(500)
  })

  it('should return JSON response', async () => {
    mockCreateTemporarySubmission.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
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

      const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json', origin: ORIGIN },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/7 consecutive days/i)
      expect(mockSessionCreate).not.toHaveBeenCalled()
    })

    it('should reject firstDayOff more than 7 days in the past', async () => {
      const badData = {
        ...mockFormData,
        firstDayOff: daysFromToday(-30),
        lastDayOff: daysFromToday(-30),
      }

      const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json', origin: ORIGIN },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/7 days in the past/i)
      expect(mockSessionCreate).not.toHaveBeenCalled()
    })

    it('should reject lastDayOff before firstDayOff', async () => {
      const badData = {
        ...mockFormData,
        firstDayOff: daysFromToday(2),
        lastDayOff: daysFromToday(1),
      }

      const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json', origin: ORIGIN },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/on or after first day off/i)
      expect(mockSessionCreate).not.toHaveBeenCalled()
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

      const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json', origin: ORIGIN },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/cannot be in the future/i)
      expect(mockSessionCreate).not.toHaveBeenCalled()
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

      const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json', origin: ORIGIN },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/valid date of birth/i)
      expect(mockSessionCreate).not.toHaveBeenCalled()
    })

    it('should reject under-18 patient when recipient=myself', async () => {
      const dob = new Date(today)
      dob.setUTCFullYear(dob.getUTCFullYear() - 5)

      const badData = {
        ...mockFormData,
        recipient: 'myself',
        patientDateOfBirth: toISODate(dob),
      }

      const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ formData: badData }),
        headers: { 'Content-Type': 'application/json', origin: ORIGIN },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toMatch(/18 or older/i)
      expect(mockSessionCreate).not.toHaveBeenCalled()
    })

    it('should accept valid dates within limits', async () => {
      mockCreateTemporarySubmission.mockResolvedValue({ id: 'temp_valid' })

      const goodData = {
        ...mockFormData,
        firstDayOff: daysFromToday(-2),
        lastDayOff: daysFromToday(2),
      }

      const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ formData: goodData }),
        headers: { 'Content-Type': 'application/json', origin: ORIGIN },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      expect(mockSessionCreate).toHaveBeenCalled()
    })
  })

  it('should handle database connection errors gracefully', async () => {
    mockCreateTemporarySubmission.mockRejectedValue(new Error('Connection timeout'))

    const request = new NextRequest('http://localhost:3000/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ formData: mockFormData }),
      headers: { 'Content-Type': 'application/json', origin: ORIGIN },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Unable to process your request. Please try again.')
  })
  describe('terms consent', () => {
    beforeEach(() => {
      mockCreateTemporarySubmission.mockResolvedValue({ id: 'temp_consent' })
    })

    it.each([
      ['enforced', 'true'],
      ['log-only', 'false'],
    ])(
      'refuses a draft without terms agreement and sends it back to review (%s)',
      async (_mode, enforced) => {
        process.env.INTAKE_VALIDATION_ENFORCED = enforced

        const response = await post({ ...mockFormData, agreeTerms: false })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
          error: 'You must agree to the Terms of Service and Privacy Policy',
          route: '/review',
        })
        expect(mockCreateTemporarySubmission).not.toHaveBeenCalled()
        expect(mockSessionCreate).not.toHaveBeenCalled()
      }
    )

    it('refuses a draft without the accuracy certification', async () => {
      const response = await post({ ...mockFormData, certifyAccurate: undefined })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'You must certify that the information is accurate',
        route: '/review',
      })
      expect(mockSessionCreate).not.toHaveBeenCalled()
    })

    it('refuses a draft that carries neither consent field, as the review page used to send', async () => {
      process.env.INTAKE_VALIDATION_ENFORCED = 'false'
      const { certifyAccurate: _certify, agreeTerms: _agree, ...withoutConsent } = mockFormData

      const response = await post(withoutConsent)

      expect(response.status).toBe(400)
      expect((await response.json()).route).toBe('/review')
      expect(mockSessionCreate).not.toHaveBeenCalled()
    })

    it('sends an earlier intake step before review when both are wrong', async () => {
      const response = await post({ ...mockFormData, notePurpose: 'legal', agreeTerms: false })

      expect(response.status).toBe(400)
      expect((await response.json()).route).toBe('/note-purpose')
    })

    it('creates the Checkout Session once both are given', async () => {
      const response = await post(mockFormData)

      expect(response.status).toBe(200)
      expect(mockSessionCreate).toHaveBeenCalledTimes(1)
    })
  })
})
