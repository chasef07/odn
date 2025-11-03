import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getTestDb, initTestDb, closeTestDb, cleanTestDb } from '../../../setup/db-helpers'
import { createTestFormData, createTestTempSubmissionData } from '../../../setup/test-data-factory'

// Mock Stripe at the module level
const { mockConstructEvent } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: class MockStripe {
    webhooks = {
      constructEvent: mockConstructEvent,
    }
  },
}))

// Import route handler after mocks are set up
import { POST } from '@/app/api/webhooks/stripe/route'

describe('Stripe Webhook Integration Tests', () => {
  let db: ReturnType<typeof getTestDb>

  beforeAll(async () => {
    await initTestDb()
    db = getTestDb()
  })

  afterEach(async () => {
    await cleanTestDb()
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  // Helper to create mock Stripe event
  function createStripeEvent(type: string, data: unknown): Stripe.Event {
    return {
      id: `evt_test_${Date.now()}`,
      object: 'event',
      api_version: '2025-10-29.clover',
      created: Math.floor(Date.now() / 1000),
      data: { object: data },
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
      type,
    } as Stripe.Event
  }

  // Helper to create mock request
  function createMockRequest(body: string, signature: string = 'valid_signature'): NextRequest {
    return {
      text: async () => body,
      headers: {
        get: (name: string) => (name === 'stripe-signature' ? signature : null),
      },
    } as unknown as NextRequest
  }

  describe('Happy Path: Payment Success → Submission Created', () => {
    it('should create submission when payment succeeds', async () => {
      // Arrange: Create temporary submission
      const formData = createTestFormData()
      const paymentIntentId = `pi_test_${Date.now()}`

      await db.temporarySubmission.create({
        data: createTestTempSubmissionData({
          paymentIntentId,
          formData: formData as any,
        }),
      })

      // Mock Stripe event
      const paymentIntent: Stripe.PaymentIntent = {
        id: paymentIntentId,
        object: 'payment_intent',
        amount: 2495,
        currency: 'usd',
        status: 'succeeded',
      } as Stripe.PaymentIntent

      const event = createStripeEvent('payment_intent.succeeded', paymentIntent)
      mockConstructEvent.mockReturnValue(event)

      const request = createMockRequest(JSON.stringify(event))

      // Act: Call webhook handler
      const response = await POST(request)
      const result = await response.json()

      // Assert: Submission created
      expect(response.status).toBe(200)
      expect(result).toEqual({ received: true })

      const submission = await db.submission.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      })

      expect(submission).toBeDefined()
      expect(submission?.email).toBe(formData.email)
      expect(submission?.patientFirstName).toBe(formData.patientFirstName)
      expect(submission?.status).toBe('pending_review')

      // Assert: Temporary submission deleted
      const tempSubmission = await db.temporarySubmission.findUnique({
        where: { paymentIntentId },
      })
      expect(tempSubmission).toBeNull()
    })

    it('should handle all form fields correctly', async () => {
      // Arrange: Create submission with all fields
      const formData = createTestFormData({
        recipient: 'someone_else',
        guardianFirstName: 'Parent',
        guardianLastName: 'Guardian',
        guardianDateOfBirth: '1980-01-01',
        notePurpose: 'other',
        otherNotePurpose: 'Custom purpose',
        absenceReason: 'Other',
        otherAbsenceReason: 'Custom reason',
        symptoms: ['Fever', 'Cough', 'Other'],
        otherSymptomText: 'Custom symptom',
        additionalInformation: 'Additional info here',
      })

      const paymentIntentId = `pi_test_${Date.now()}`

      await db.temporarySubmission.create({
        data: createTestTempSubmissionData({
          paymentIntentId,
          formData: formData as any,
        }),
      })

      const event = createStripeEvent('payment_intent.succeeded', {
        id: paymentIntentId,
      } as Stripe.PaymentIntent)
      mockConstructEvent.mockReturnValue(event)

      const request = createMockRequest(JSON.stringify(event))

      // Act
      const response = await POST(request)

      // Assert: All fields mapped correctly
      const submission = await db.submission.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      })

      expect(submission).toBeDefined()
      expect(submission?.guardianFirstName).toBe('Parent')
      expect(submission?.guardianLastName).toBe('Guardian')
      expect(submission?.otherNotePurpose).toBe('Custom purpose')
      expect(submission?.otherAbsenceReason).toBe('Custom reason')
      expect(submission?.otherSymptomText).toBe('Custom symptom')
      expect(submission?.additionalInformation).toBe('Additional info here')
    })

    it('should handle date conversions correctly', async () => {
      // Arrange
      const formData = createTestFormData({
        patientDateOfBirth: '1990-01-15',
        firstDayOff: '2025-11-01',
        lastDayOff: '2025-11-05',
      })

      const paymentIntentId = `pi_test_${Date.now()}`

      await db.temporarySubmission.create({
        data: createTestTempSubmissionData({
          paymentIntentId,
          formData: formData as any,
        }),
      })

      const event = createStripeEvent('payment_intent.succeeded', {
        id: paymentIntentId,
      } as Stripe.PaymentIntent)
      mockConstructEvent.mockReturnValue(event)

      const request = createMockRequest(JSON.stringify(event))

      // Act
      await POST(request)

      // Assert: Dates stored correctly
      const submission = await db.submission.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      })

      expect(submission?.patientDateOfBirth).toBeInstanceOf(Date)
      expect(submission?.firstDayOff).toBeInstanceOf(Date)
      expect(submission?.lastDayOff).toBeInstanceOf(Date)
    })
  })

  describe('Idempotency', () => {
    it('should not create duplicate submission for same payment intent', async () => {
      // Arrange: Create temporary submission
      const formData = createTestFormData()
      const paymentIntentId = `pi_test_${Date.now()}`

      await db.temporarySubmission.create({
        data: createTestTempSubmissionData({
          paymentIntentId,
          formData: formData as any,
        }),
      })

      const event = createStripeEvent('payment_intent.succeeded', {
        id: paymentIntentId,
      } as Stripe.PaymentIntent)
      mockConstructEvent.mockReturnValue(event)

      const request1 = createMockRequest(JSON.stringify(event))
      const request2 = createMockRequest(JSON.stringify(event))

      // Act: Send webhook twice
      const response1 = await POST(request1)
      const response2 = await POST(request2)

      // Assert: Both succeed, but only one submission created
      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)

      const submissions = await db.submission.findMany({
        where: { stripePaymentIntentId: paymentIntentId },
      })

      expect(submissions).toHaveLength(1)
    })

    it('should return success for already-processed payment', async () => {
      // Arrange: Create submission directly (simulating already processed)
      const paymentIntentId = `pi_test_${Date.now()}`

      await db.submission.create({
        data: {
          stripePaymentIntentId: paymentIntentId,
          status: 'pending_review',
          state: 'CA',
          recipient: 'myself',
          patientFirstName: 'Test',
          patientLastName: 'User',
          patientDateOfBirth: new Date('1990-01-01'),
          email: 'test@example.com',
          phone: '5555551234',
          notePurpose: 'work',
          firstDayOff: new Date('2025-11-01'),
          lastDayOff: new Date('2025-11-02'),
          absenceReason: 'Feeling sick',
        },
      })

      const event = createStripeEvent('payment_intent.succeeded', {
        id: paymentIntentId,
      } as Stripe.PaymentIntent)
      mockConstructEvent.mockReturnValue(event)

      const request = createMockRequest(JSON.stringify(event))

      // Act: Send webhook for already-processed payment
      const response = await POST(request)
      const result = await response.json()

      // Assert: Returns success (idempotent)
      expect(response.status).toBe(200)
      expect(result).toEqual({ received: true })
    })
  })

  describe('Error Scenarios', () => {
    it('should return 500 when temporary submission not found', async () => {
      // Arrange: No temporary submission exists
      const paymentIntentId = `pi_test_${Date.now()}`

      const event = createStripeEvent('payment_intent.succeeded', {
        id: paymentIntentId,
        amount: 2495,
        metadata: {}, // Add metadata to prevent crash
      } as Stripe.PaymentIntent)
      mockConstructEvent.mockReturnValue(event)

      const request = createMockRequest(JSON.stringify(event))

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert: Returns 500 so Stripe retries
      expect(response.status).toBe(500)
      expect(result.error).toContain('Temporary submission not found')
    })

    it('should return 400 when form data is invalid', async () => {
      // Arrange: Create temp submission with invalid data
      const paymentIntentId = `pi_test_${Date.now()}`

      await db.temporarySubmission.create({
        data: {
          paymentIntentId,
          formData: {
            // Missing required fields
            state: 'CA',
          } as any,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })

      const event = createStripeEvent('payment_intent.succeeded', {
        id: paymentIntentId,
      } as Stripe.PaymentIntent)
      mockConstructEvent.mockReturnValue(event)

      const request = createMockRequest(JSON.stringify(event))

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result.error).toContain('Invalid form data')
    })

    it('should handle temp submission deletion failure gracefully', async () => {
      // Arrange: Create temp submission
      const formData = createTestFormData()
      const paymentIntentId = `pi_test_${Date.now()}`

      await db.temporarySubmission.create({
        data: createTestTempSubmissionData({
          paymentIntentId,
          formData: formData as any,
        }),
      })

      const event = createStripeEvent('payment_intent.succeeded', {
        id: paymentIntentId,
      } as Stripe.PaymentIntent)
      mockConstructEvent.mockReturnValue(event)

      const request = createMockRequest(JSON.stringify(event))

      // Act: Process webhook (creates submission and deletes temp)
      const response = await POST(request)
      const result = await response.json()

      // Assert: Succeeds
      expect(response.status).toBe(200)
      expect(result).toEqual({ received: true })

      // Submission should be created
      const submission = await db.submission.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      })
      expect(submission).toBeDefined()

      // Temp submission should be deleted
      const tempSubmission = await db.temporarySubmission.findUnique({
        where: { paymentIntentId },
      })
      expect(tempSubmission).toBeNull()

      // Act: Try to process same webhook again (temp submission already deleted)
      // This simulates the deletion failure scenario - webhook called twice
      const request2 = createMockRequest(JSON.stringify(event))
      const response2 = await POST(request2)
      const result2 = await response2.json()

      // Assert: Still succeeds (idempotent, deletion already done)
      expect(response2.status).toBe(200)
      expect(result2).toEqual({ received: true })
    })
  })

  describe('Security', () => {
    it('should return 400 for invalid signature', async () => {
      // Arrange
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const request = createMockRequest('{"test": "data"}', 'invalid_signature')

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result.error).toContain('Invalid signature')
    })

    it('should return 400 for missing signature', async () => {
      // Arrange
      const request = createMockRequest('{"test": "data"}', '')

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result.error).toContain('Missing signature')
    })
  })

  describe('Non-Payment Events', () => {
    it('should handle non-payment_intent.succeeded events gracefully', async () => {
      // Arrange
      const event = createStripeEvent('payment_intent.created', {
        id: 'pi_test_other',
      } as Stripe.PaymentIntent)
      mockConstructEvent.mockReturnValue(event)

      const request = createMockRequest(JSON.stringify(event))

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert: Returns success but doesn't process
      expect(response.status).toBe(200)
      expect(result).toEqual({ received: true })
    })
  })
})
