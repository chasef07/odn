import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import type { FormData } from '@/lib/form-storage'

// --- Mocks ---------------------------------------------------------------

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

// SubmissionStatus enum mock (matches generated @prisma/client shape we use)
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Import AFTER mocks
import { POST } from '../route'

// --- Helpers -------------------------------------------------------------

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

// --- Tests ---------------------------------------------------------------

describe('POST /api/webhooks/stripe-prod3 - server-side re-validation', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    vi.clearAllMocks()

    // Default: no existing submission (fresh event)
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
  })

  it('routes to MAYBE with denialReason note when absence exceeds 7 days', async () => {
    mockWebhookConstructEvent.mockReturnValue(buildEvent())
    const badFormData = {
      ...validFormData,
      firstDayOff: daysFromToday(0),
      lastDayOff: daysFromToday(10), // 11 inclusive days
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
    expect(createArg.data.denialReason).toMatch(/Auto-flagged/)
    expect(createArg.data.denialReason).toMatch(/7 consecutive days/i)

    // Clear admin-facing log so doctor can find the submission
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
    expect(createArg.data.denialReason).toMatch(/18 or older/i)
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
    expect(createArg.data.denialReason).toMatch(/valid patient date of birth/i)
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
        reasons: expect.arrayContaining([expect.stringMatching(/Missing required fields: patientLastName/)]),
      })
    )

    consoleError.mockRestore()
  })
})
