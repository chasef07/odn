import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import type { FormData } from '@/lib/form-storage'

const {
  mockSubmissionFindUnique,
  mockSubmissionCreate,
  mockTempFindUnique,
  mockTempUpdate,
  mockTempDelete,
} = vi.hoisted(() => ({
  mockSubmissionFindUnique: vi.fn(),
  mockSubmissionCreate: vi.fn(),
  mockTempFindUnique: vi.fn(),
  mockTempUpdate: vi.fn(),
  mockTempDelete: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    submission: {
      findUnique: mockSubmissionFindUnique,
      create: mockSubmissionCreate,
    },
    temporarySubmission: {
      findUnique: mockTempFindUnique,
      update: mockTempUpdate,
      delete: mockTempDelete,
    },
  },
}))

vi.mock('@prisma/client', () => ({
  SubmissionStatus: {
    PENDING_REVIEW: 'PENDING_REVIEW',
    APPROVED: 'APPROVED',
    DENIED: 'DENIED',
    MAYBE: 'MAYBE',
    MANUAL: 'MANUAL',
  },
}))

const { mockWebhookConstructEvent } = vi.hoisted(() => ({
  mockWebhookConstructEvent: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class MockStripe {
    webhooks: { constructEvent: typeof mockWebhookConstructEvent }
    constructor() {
      this.webhooks = { constructEvent: mockWebhookConstructEvent }
    }
  },
}))

const { mockSendPaymentConfirmationEmail } = vi.hoisted(() => ({
  mockSendPaymentConfirmationEmail: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/email', () => ({
  sendPaymentConfirmationEmail: mockSendPaymentConfirmationEmail,
}))

const { mockSendTransactionalSmsForSubmission } = vi.hoisted(() => ({
  mockSendTransactionalSmsForSubmission: vi.fn(),
}))
vi.mock('@/lib/telnyx', () => ({
  sendTransactionalSmsForSubmission: mockSendTransactionalSmsForSubmission,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { POST } from '../route'

const now = new Date()
const toISODate = (d: Date) => d.toISOString().split('T')[0]
const daysFromToday = (n: number) => {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() + n)
  return toISODate(d)
}

const validFormData: FormData = {
  state: 'CA',
  recipient: 'myself',
  patientFirstName: 'John',
  patientLastName: 'Doe',
  patientDateOfBirth: '1990-01-01',
  email: 'john@example.com',
  phone: '5551234567',
  smsOptIn: true,
  notePurpose: 'work',
  firstDayOff: daysFromToday(-1),
  lastDayOff: daysFromToday(1),
  absenceReason: 'illness',
}

function buildRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/webhooks/stripe-prod3', {
    method: 'POST',
    body: 'irrelevant-body-signature-mocked',
    headers: { 'stripe-signature': 'test-signature' },
  })
}

function buildEvent(overrides: Partial<Stripe.Event> = {}): Stripe.Event {
  return {
    id: 'evt_test',
    type: 'payment_intent.succeeded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pi_test_123',
        amount: 2495,
        currency: 'usd',
        metadata: { email: 'john@example.com' },
      },
    },
    ...overrides,
  } as unknown as Stripe.Event
}

describe('POST /api/webhooks/stripe-prod3 - server-side re-validation', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    vi.clearAllMocks()
    mockSendPaymentConfirmationEmail.mockResolvedValue(undefined)
    mockSendTransactionalSmsForSubmission.mockResolvedValue(undefined)

    mockSubmissionFindUnique.mockResolvedValue(null)
    mockTempDelete.mockResolvedValue({})
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('creates submission with PENDING_REVIEW when data is valid', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_ok',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockSubmissionCreate.mockResolvedValue({
      id: 'sub_ok',
      email: validFormData.email,
      patientFirstName: validFormData.patientFirstName,
    })

    const response = await POST(buildRequest())
    expect(response.status).toBe(200)

    expect(mockSubmissionCreate).toHaveBeenCalledTimes(1)
    const createArg = mockSubmissionCreate.mock.calls[0][0]
    expect(createArg.data.status).toBe('PENDING_REVIEW')
    expect(createArg.data.denialReason).toBeNull()
    expect(createArg.data.paymentAmount).toBe(2495)
    expect(createArg.data.offerCode).toBeNull()
    expect(createArg.data.offerPriceId).toBeNull()
    expect(mockSendPaymentConfirmationEmail).toHaveBeenCalledWith({
      to: 'john@example.com',
      patientName: 'John',
      submissionId: 'sub_ok',
    })
  })

  it('acknowledges Stripe after a failed purchase email attempt without losing the submission', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_email_failure',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockSubmissionCreate.mockResolvedValue({
      id: 'sub_email_failure',
      email: validFormData.email,
      patientFirstName: validFormData.patientFirstName,
    })
    mockSendPaymentConfirmationEmail.mockRejectedValue(new Error('Resend unavailable'))

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mockSubmissionCreate).toHaveBeenCalledOnce()
    expect(mockSendPaymentConfirmationEmail).toHaveBeenCalledOnce()
  })

  it('does not resend the purchase email when Stripe retries an existing submission', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockSubmissionFindUnique.mockResolvedValue({ id: 'sub_existing' })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mockSubmissionCreate).not.toHaveBeenCalled()
    expect(mockSendPaymentConfirmationEmail).not.toHaveBeenCalled()
  })

  it('sends purchase confirmation SMS when opted in', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_sms',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockSubmissionCreate.mockResolvedValue({
      id: '78a58d67-1111-4444-8888-123456789abc',
      email: validFormData.email,
      patientFirstName: validFormData.patientFirstName,
      phone: '(555) 123-4567',
      smsOptIn: true,
    })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mockSendTransactionalSmsForSubmission).toHaveBeenCalledWith({
      submission: expect.objectContaining({
        id: '78a58d67-1111-4444-8888-123456789abc',
        phone: '(555) 123-4567',
        smsOptIn: true,
      }),
      type: 'PURCHASE_CONFIRMATION',
      body: expect.stringMatching(/Ref #78A58D67[\s\S]*Reply HELP[\s\S]*STOP to opt out/),
    })
  })

  it('does not wait for purchase confirmation SMS before acknowledging Stripe', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    let resolveSms: () => void = () => {}
    mockSendTransactionalSmsForSubmission.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSms = resolve
      })
    )
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_sms_pending',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockSubmissionCreate.mockResolvedValue({
      id: 'sub_sms_pending',
      email: validFormData.email,
      patientFirstName: validFormData.patientFirstName,
      phone: '(555) 123-4567',
      smsOptIn: true,
    })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mockSendTransactionalSmsForSubmission).toHaveBeenCalled()

    resolveSms()
  })

  it('does not send purchase confirmation SMS when opted out', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_no_sms',
      paymentIntentId: 'pi_test_123',
      formData: {
        ...validFormData,
        smsOptIn: false,
      },
    })
    mockSubmissionCreate.mockResolvedValue({
      id: 'sub_no_sms',
      email: validFormData.email,
      patientFirstName: validFormData.patientFirstName,
      phone: '(555) 123-4567',
      smsOptIn: false,
    })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()
  })

  it('does not fail the Stripe webhook when purchase SMS fails', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockSendTransactionalSmsForSubmission.mockRejectedValue(new Error('Telnyx unavailable'))
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_sms_error',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockSubmissionCreate.mockResolvedValue({
      id: 'sub_sms_error',
      email: validFormData.email,
      patientFirstName: validFormData.patientFirstName,
      phone: '(555) 123-4567',
      smsOptIn: true,
    })
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mockSendTransactionalSmsForSubmission).toHaveBeenCalled()
    await Promise.resolve()
    expect(consoleWarn).toHaveBeenCalledWith(
      'Failed to send transactional SMS (non-critical):',
      expect.objectContaining({
        submissionId: 'sub_sms_error',
        type: 'PURCHASE_CONFIRMATION',
      })
    )

    consoleWarn.mockRestore()
  })

  it('stores friends and family offer metadata on the submission', async () => {
    mockWebhookConstructEvent.mockReturnValue(
      buildEvent({
        data: {
          object: {
            id: 'pi_test_123',
            amount: 2000,
            currency: 'usd',
            metadata: {
              email: 'john@example.com',
              price_id: 'price_friends_family_mock',
              price_type: 'friends_family',
              offer_code: 'friends20',
              offer_price_id: 'price_friends_family_mock',
            },
          },
        },
      } as Partial<Stripe.Event>)
    )
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_offer',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockSubmissionCreate.mockResolvedValue({
      id: 'sub_offer',
      email: validFormData.email,
      patientFirstName: validFormData.patientFirstName,
    })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    const createArg = mockSubmissionCreate.mock.calls[0][0]
    expect(createArg.data.paymentAmount).toBe(2000)
    expect(createArg.data.offerCode).toBe('friends20')
    expect(createArg.data.offerPriceId).toBe('price_friends_family_mock')
  })

  it('stores attribution from the temporary submission on the submission', async () => {
    const touch = {
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
    }
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_attr',
      paymentIntentId: 'pi_test_123',
      formData: { ...validFormData, attribution: { first: touch, last: touch } },
    })
    mockSubmissionCreate.mockResolvedValue({
      id: 'sub_attr',
      email: validFormData.email,
      patientFirstName: validFormData.patientFirstName,
    })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    const createArg = mockSubmissionCreate.mock.calls[0][0]
    expect(createArg.data.attributionChannel).toBe('reddit')
    expect(createArg.data.utmSource).toBe('reddit')
    expect(createArg.data.utmMedium).toBe('paid')
    expect(createArg.data.utmCampaign).toBe('fall_promo')
    expect(createArg.data.attribution).toEqual({ first: touch, last: touch })
  })

  it('leaves attribution empty when the temporary submission has none', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_none',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockSubmissionCreate.mockResolvedValue({
      id: 'sub_none',
      email: validFormData.email,
      patientFirstName: validFormData.patientFirstName,
    })

    await POST(buildRequest())

    const createArg = mockSubmissionCreate.mock.calls[0][0]
    expect(createArg.data.attributionChannel).toBeNull()
    expect(createArg.data.attribution).toBeUndefined()
  })

  it('routes to MAYBE with an internal maybe reason note when absence exceeds 7 days', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    const badFormData = {
      ...validFormData,
      firstDayOff: daysFromToday(0),
      lastDayOff: daysFromToday(10),
    }
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_bad_dates',
      paymentIntentId: 'pi_test_123',
      formData: badFormData,
    })
    mockSubmissionCreate.mockResolvedValue({
      id: 'sub_maybe',
      email: badFormData.email,
      patientFirstName: badFormData.patientFirstName,
    })

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(buildRequest())
    expect(response.status).toBe(200)

    expect(mockSubmissionCreate).toHaveBeenCalledTimes(1)
    const createArg = mockSubmissionCreate.mock.calls[0][0]
    expect(createArg.data.status).toBe('MAYBE')
    expect(createArg.data.denialReason).toBeNull()
    expect(createArg.data.maybeReason).toBe('INTERNAL_ONLY')
    expect(createArg.data.maybeInternalNote).toMatch(/Auto-flagged/)
    expect(createArg.data.maybeInternalNote).toMatch(/7 consecutive days/i)
    expect(createArg.data.maybeEmailSentAt).toBeNull()

    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })

  it('routes to MAYBE when recipient=myself but patient is under 18', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    const dob = new Date(now)
    dob.setUTCFullYear(dob.getUTCFullYear() - 10)
    const badFormData = {
      ...validFormData,
      recipient: 'myself' as const,
      patientDateOfBirth: toISODate(dob),
    }
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_minor',
      paymentIntentId: 'pi_test_123',
      formData: badFormData,
    })
    mockSubmissionCreate.mockResolvedValue({
      id: 'sub_minor_maybe',
      email: badFormData.email,
      patientFirstName: badFormData.patientFirstName,
    })

    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(buildRequest())
    expect(response.status).toBe(200)

    const createArg = mockSubmissionCreate.mock.calls[0][0]
    expect(createArg.data.status).toBe('MAYBE')
    expect(createArg.data.denialReason).toBeNull()
    expect(createArg.data.maybeReason).toBe('INTERNAL_ONLY')
    expect(createArg.data.maybeInternalNote).toMatch(/18 or older/i)
  })

  it('routes to MAYBE when recipient=someone_else and patient DOB is in the future', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    const badFormData = {
      ...validFormData,
      recipient: 'someone_else' as const,
      patientDateOfBirth: daysFromToday(30),
      guardianFirstName: 'Jane',
      guardianLastName: 'Doe',
      guardianDateOfBirth: '1980-01-01',
    }
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_future_dob',
      paymentIntentId: 'pi_test_123',
      formData: badFormData,
    })
    mockSubmissionCreate.mockResolvedValue({
      id: 'sub_future_maybe',
      email: badFormData.email,
      patientFirstName: badFormData.patientFirstName,
    })

    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(buildRequest())
    expect(response.status).toBe(200)

    const createArg = mockSubmissionCreate.mock.calls[0][0]
    expect(createArg.data.status).toBe('MAYBE')
    expect(createArg.data.denialReason).toBeNull()
    expect(createArg.data.maybeReason).toBe('INTERNAL_ONLY')
    expect(createArg.data.maybeInternalNote).toMatch(/valid patient date of birth/i)
  })

  it('keeps malformed paid submissions retryable when required persisted fields are missing', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockTempFindUnique.mockResolvedValue({
      id: 'temp_missing_required',
      paymentIntentId: 'pi_test_123',
      formData: {
        ...validFormData,
        patientLastName: '',
      },
    })

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(buildRequest())
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: 'Paid submission requires manual recovery' })
    expect(mockSubmissionCreate).not.toHaveBeenCalled()
    expect(mockTempDelete).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      'PAID SUBMISSION CANNOT BE PERSISTED - leaving webhook retryable',
      expect.objectContaining({
        tempSubmissionId: 'temp_missing_required',
        reasons: expect.arrayContaining([
          expect.stringMatching(/Missing required fields: patientLastName/),
        ]),
      })
    )

    consoleError.mockRestore()
  })
})
