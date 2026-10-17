import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import type { FormData } from '@/lib/form-storage'

const {
  mockFindSubmissionIdForPaymentIntent,
  mockInsertSubmission,
  mockFindTempByPaymentIntent,
  mockFindTempById,
  mockAttachPaymentIntent,
  mockDeleteTemp,
} = vi.hoisted(() => ({
  mockFindSubmissionIdForPaymentIntent: vi.fn(),
  mockInsertSubmission: vi.fn(),
  mockFindTempByPaymentIntent: vi.fn(),
  mockFindTempById: vi.fn(),
  mockAttachPaymentIntent: vi.fn(),
  mockDeleteTemp: vi.fn(),
}))

vi.mock('@/db/submissions', () => ({
  findSubmissionIdForPaymentIntent: mockFindSubmissionIdForPaymentIntent,
  insertSubmission: mockInsertSubmission,
}))

vi.mock('@/db/temporary-submissions', () => ({
  findTemporarySubmissionByPaymentIntent: mockFindTempByPaymentIntent,
  findTemporarySubmissionById: mockFindTempById,
  attachPaymentIntentToTemporarySubmission: mockAttachPaymentIntent,
  deleteTemporarySubmission: mockDeleteTemp,
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

import { revalidatePath } from 'next/cache'
import { POST } from '../route'

const now = new Date()
const toISODate = (d: Date) => d.toISOString().split('T')[0]
const daysFromToday = (n: number) => {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() + n)
  return toISODate(d)
}

const validFormData: FormData = {
  state: 'California',
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
  absenceReason: 'Feeling sick',
  symptoms: ['Fever or chills'],
}

function buildRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/webhooks/stripe-prod3', {
    method: 'POST',
    body: 'irrelevant-body-signature-mocked',
    headers: { 'stripe-signature': 'test-signature' },
  })
}

function buildEvent(
  paymentIntent: Partial<Stripe.PaymentIntent> = {
    id: 'pi_test_123',
    amount: 2495,
    currency: 'usd',
    metadata: { email: 'john@example.com' },
  }
): Stripe.Event {
  return {
    id: 'evt_test',
    type: 'payment_intent.succeeded',
    created: Math.floor(Date.now() / 1000),
    data: { object: paymentIntent },
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

    mockFindSubmissionIdForPaymentIntent.mockResolvedValue(null)
    mockDeleteTemp.mockResolvedValue({})
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('creates submission with PENDING_REVIEW when data is valid', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_ok',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_ok',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
      },
      inserted: true,
    })

    const response = await POST(buildRequest())
    expect(response.status).toBe(200)

    expect(mockInsertSubmission).toHaveBeenCalledTimes(1)
    const createArg = mockInsertSubmission.mock.calls[0][0]
    expect(createArg.status).toBe('PENDING_REVIEW')
    expect(createArg.denialReason).toBeNull()
    expect(createArg.paymentAmount).toBe(2495)
    expect(createArg.offerCode).toBeNull()
    expect(createArg.offerPriceId).toBeNull()
    expect(mockSendPaymentConfirmationEmail).toHaveBeenCalledWith({
      to: 'john@example.com',
      patientName: 'John',
      submissionId: 'sub_ok',
    })
  })

  it('acknowledges Stripe after a failed purchase email attempt without losing the submission', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_email_failure',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_email_failure',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
      },
      inserted: true,
    })
    mockSendPaymentConfirmationEmail.mockRejectedValue(new Error('Resend unavailable'))

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mockInsertSubmission).toHaveBeenCalledOnce()
    expect(mockSendPaymentConfirmationEmail).toHaveBeenCalledOnce()
  })

  it('acknowledges a concurrent duplicate delivery without emailing or texting again', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_dup',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_first',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
        phone: '(555) 123-4567',
        smsOptIn: true,
      },
      inserted: false,
    })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mockInsertSubmission).toHaveBeenCalledOnce()
    expect(mockSendPaymentConfirmationEmail).not.toHaveBeenCalled()
    expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('does not resend the purchase email when Stripe retries an existing submission', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockFindSubmissionIdForPaymentIntent.mockResolvedValue({ id: 'sub_existing' })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mockInsertSubmission).not.toHaveBeenCalled()
    expect(mockSendPaymentConfirmationEmail).not.toHaveBeenCalled()
  })

  it('sends purchase confirmation SMS when opted in', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_sms',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: '78a58d67-1111-4444-8888-123456789abc',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
        phone: '(555) 123-4567',
        smsOptIn: true,
      },
      inserted: true,
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
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_sms_pending',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_sms_pending',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
        phone: '(555) 123-4567',
        smsOptIn: true,
      },
      inserted: true,
    })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mockSendTransactionalSmsForSubmission).toHaveBeenCalled()

    resolveSms()
  })

  it('does not send purchase confirmation SMS when opted out', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_no_sms',
      paymentIntentId: 'pi_test_123',
      formData: {
        ...validFormData,
        smsOptIn: false,
      },
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_no_sms',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
        phone: '(555) 123-4567',
        smsOptIn: false,
      },
      inserted: true,
    })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mockSendTransactionalSmsForSubmission).not.toHaveBeenCalled()
  })

  it('does not fail the Stripe webhook when purchase SMS fails', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockSendTransactionalSmsForSubmission.mockRejectedValue(new Error('Telnyx unavailable'))
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_sms_error',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_sms_error',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
        phone: '(555) 123-4567',
        smsOptIn: true,
      },
      inserted: true,
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
      })
    )
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_offer',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_offer',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
      },
      inserted: true,
    })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    const createArg = mockInsertSubmission.mock.calls[0][0]
    expect(createArg.paymentAmount).toBe(2000)
    expect(createArg.offerCode).toBe('friends20')
    expect(createArg.offerPriceId).toBe('price_friends_family_mock')
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
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_attr',
      paymentIntentId: 'pi_test_123',
      formData: { ...validFormData, attribution: { first: touch, last: touch } },
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_attr',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
      },
      inserted: true,
    })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    const createArg = mockInsertSubmission.mock.calls[0][0]
    expect(createArg.attributionChannel).toBe('reddit')
    expect(createArg.utmSource).toBe('reddit')
    expect(createArg.utmMedium).toBe('paid')
    expect(createArg.utmCampaign).toBe('fall_promo')
    expect(createArg.attribution).toEqual({ first: touch, last: touch })
  })

  it('leaves attribution empty when the temporary submission has none', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_none',
      paymentIntentId: 'pi_test_123',
      formData: validFormData,
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_none',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
      },
      inserted: true,
    })

    await POST(buildRequest())

    const createArg = mockInsertSubmission.mock.calls[0][0]
    expect(createArg.attributionChannel).toBeNull()
    expect(createArg.attribution).toBeUndefined()
  })

  it('routes to MAYBE with an internal maybe reason note when absence exceeds 7 days', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    const badFormData = {
      ...validFormData,
      firstDayOff: daysFromToday(0),
      lastDayOff: daysFromToday(10),
    }
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_bad_dates',
      paymentIntentId: 'pi_test_123',
      formData: badFormData,
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_maybe',
        email: badFormData.email,
        patientFirstName: badFormData.patientFirstName,
      },
      inserted: true,
    })

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(buildRequest())
    expect(response.status).toBe(200)

    expect(mockInsertSubmission).toHaveBeenCalledTimes(1)
    const createArg = mockInsertSubmission.mock.calls[0][0]
    expect(createArg.status).toBe('MAYBE')
    expect(createArg.denialReason).toBeNull()
    expect(createArg.maybeReason).toBe('INTERNAL_ONLY')
    expect(createArg.maybeInternalNote).toMatch(/Auto-flagged/)
    expect(createArg.maybeInternalNote).toMatch(/7 consecutive days/i)
    expect(createArg.maybeEmailSentAt).toBeNull()

    expect(consoleError).toHaveBeenCalledTimes(1)
    const line = consoleError.mock.calls[0][0]
    expect(consoleError.mock.calls[0]).toHaveLength(1)
    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toEqual({
      severity: 'ERROR',
      event: 'intake_rule_failure',
      endpoint: '/api/webhooks/stripe-prod3',
      eventId: 'evt_test',
      paymentIntentId: 'pi_test_123',
      tempSubmissionId: 'temp_bad_dates',
      issues: [{ rule: 'absence_too_long', field: 'lastDayOff', route: '/absence-dates' }],
    })

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
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_minor',
      paymentIntentId: 'pi_test_123',
      formData: badFormData,
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_minor_maybe',
        email: badFormData.email,
        patientFirstName: badFormData.patientFirstName,
      },
      inserted: true,
    })

    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(buildRequest())
    expect(response.status).toBe(200)

    const createArg = mockInsertSubmission.mock.calls[0][0]
    expect(createArg.status).toBe('MAYBE')
    expect(createArg.denialReason).toBeNull()
    expect(createArg.maybeReason).toBe('INTERNAL_ONLY')
    expect(createArg.maybeInternalNote).toMatch(/18 or older/i)
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
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_future_dob',
      paymentIntentId: 'pi_test_123',
      formData: badFormData,
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_future_maybe',
        email: badFormData.email,
        patientFirstName: badFormData.patientFirstName,
      },
      inserted: true,
    })

    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(buildRequest())
    expect(response.status).toBe(200)

    const createArg = mockInsertSubmission.mock.calls[0][0]
    expect(createArg.status).toBe('MAYBE')
    expect(createArg.denialReason).toBeNull()
    expect(createArg.maybeReason).toBe('INTERNAL_ONLY')
    expect(createArg.maybeInternalNote).toMatch(/cannot be in the future/i)
  })

  it('persists a paid legal-purpose draft as MAYBE', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_legal',
      paymentIntentId: 'pi_test_123',
      formData: { ...validFormData, notePurpose: 'legal' },
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_legal',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
      },
      inserted: true,
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(buildRequest())

    expect({ status: response.status, created: mockInsertSubmission.mock.calls.length }).toEqual({
      status: 200,
      created: 1,
    })
    const createArg = mockInsertSubmission.mock.calls[0][0]
    expect(createArg.status).toBe('MAYBE')
    expect(createArg.maybeInternalNote).toMatch(/notePurpose: .*legal matters/i)
    expect(mockDeleteTemp).toHaveBeenCalledTimes(1)
  })

  it('notes every failing field when persisting as MAYBE', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_state',
      paymentIntentId: 'pi_test_123',
      formData: { ...validFormData, state: 'CA', email: 'john@gmail.con' },
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_state',
        email: validFormData.email,
        patientFirstName: validFormData.patientFirstName,
      },
      inserted: true,
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    const createArg = mockInsertSubmission.mock.calls[0][0]
    expect(createArg.status).toBe('MAYBE')
    expect(createArg.maybeInternalNote).toMatch(/state: Please select a state from the list/)
    expect(createArg.maybeInternalNote).toMatch(/email: Did you mean "\.com"/)
  })

  it('stores the normalized phone and lowercased email', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockFindTempByPaymentIntent.mockResolvedValue({
      id: 'temp_phone',
      paymentIntentId: 'pi_test_123',
      formData: { ...validFormData, phone: '+1 555 123 4567', email: 'John@Example.com' },
    })
    mockInsertSubmission.mockResolvedValue({
      submission: {
        id: 'sub_phone',
        email: 'john@example.com',
        patientFirstName: validFormData.patientFirstName,
      },
      inserted: true,
    })

    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    const createArg = mockInsertSubmission.mock.calls[0][0]
    expect(createArg.status).toBe('PENDING_REVIEW')
    expect(createArg.phone).toBe('(555) 123-4567')
    expect(createArg.smsPhoneE164).toBe('+15551234567')
    expect(createArg.email).toBe('john@example.com')
    expect(createArg.patientDateOfBirth).toEqual(new Date('1990-01-01T00:00:00.000Z'))
  })

  it('keeps malformed paid submissions retryable when required persisted fields are missing', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    mockFindTempByPaymentIntent.mockResolvedValue({
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
    expect(mockInsertSubmission).not.toHaveBeenCalled()
    expect(mockDeleteTemp).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledTimes(1)
    const line = consoleError.mock.calls[0][0]
    expect(consoleError.mock.calls[0]).toHaveLength(1)
    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toEqual({
      severity: 'ERROR',
      event: 'intake_shape_failure',
      endpoint: '/api/webhooks/stripe-prod3',
      eventId: 'evt_test',
      paymentIntentId: 'pi_test_123',
      tempSubmissionId: 'temp_missing_required',
      issues: [{ rule: 'required', field: 'patientLastName', route: '/basic-info' }],
    })

    consoleError.mockRestore()
  })
})
