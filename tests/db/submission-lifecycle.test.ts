import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { getTestDb, initTestDb, closeTestDb, cleanTestDb } from '../setup/db-helpers'
import {
  createTestSubmissionData,
  createTestTempSubmissionData,
  createTestSubmissionWithGuardian,
  createExpiredTempSubmission,
  createMultipleTestSubmissions,
} from '../setup/test-data-factory'

describe('Submission Lifecycle Integration Tests', () => {
  let db: ReturnType<typeof getTestDb>

  beforeAll(async () => {
    await initTestDb()
    db = getTestDb()
  })

  afterEach(async () => {
    await cleanTestDb()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  describe('Full Lifecycle: Temporary → Permanent', () => {
    it('should handle complete submission lifecycle', async () => {
      // Step 1: Create temporary submission (on payment intent creation)
      const paymentIntentId = `pi_test_lifecycle_${Date.now()}`
      const tempSubmission = await db.temporarySubmission.create({
        data: createTestTempSubmissionData({
          paymentIntentId,
        }),
      })

      expect(tempSubmission.id).toBeDefined()
      expect(tempSubmission.paymentIntentId).toBe(paymentIntentId)

      // Step 2: Verify temporary submission exists
      const foundTemp = await db.temporarySubmission.findUnique({
        where: { paymentIntentId },
      })
      expect(foundTemp).toBeDefined()

      // Step 3: Payment succeeds - create permanent submission
      const submission = await db.submission.create({
        data: createTestSubmissionData({
          stripePaymentIntentId: paymentIntentId,
        }),
      })

      expect(submission.id).toBeDefined()
      expect(submission.stripePaymentIntentId).toBe(paymentIntentId)
      expect(submission.status).toBe('pending_review')

      // Step 4: Delete temporary submission
      await db.temporarySubmission.delete({
        where: { id: tempSubmission.id },
      })

      // Step 5: Verify cleanup
      const deletedTemp = await db.temporarySubmission.findUnique({
        where: { paymentIntentId },
      })
      expect(deletedTemp).toBeNull()

      const permanentSubmission = await db.submission.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      })
      expect(permanentSubmission).toBeDefined()
    })

    it('should handle submission with guardian info', async () => {
      // Act: Create submission for someone else (with guardian)
      const submission = await db.submission.create({
        data: createTestSubmissionWithGuardian(),
      })

      // Assert: Guardian fields populated
      expect(submission.recipient).toBe('someone_else')
      expect(submission.guardianFirstName).toBe('Parent')
      expect(submission.guardianLastName).toBe('Guardian')
      expect(submission.guardianDateOfBirth).toBeDefined()
    })

    it('should handle submission without guardian info', async () => {
      // Act: Create submission for myself (no guardian)
      const submission = await db.submission.create({
        data: createTestSubmissionData({
          recipient: 'myself',
          guardianFirstName: null,
          guardianLastName: null,
          guardianDateOfBirth: null,
        }),
      })

      // Assert: Guardian fields null
      expect(submission.recipient).toBe('myself')
      expect(submission.guardianFirstName).toBeNull()
      expect(submission.guardianLastName).toBeNull()
      expect(submission.guardianDateOfBirth).toBeNull()
    })
  })

  describe('Status Workflow', () => {
    it('should create submission with pending_review status', async () => {
      // Act
      const submission = await db.submission.create({
        data: createTestSubmissionData(),
      })

      // Assert
      expect(submission.status).toBe('pending_review')
      expect(submission.reviewedAt).toBeNull()
      expect(submission.reviewedByAdminId).toBeNull()
    })

    it('should update submission to approved', async () => {
      // Arrange
      const submission = await db.submission.create({
        data: createTestSubmissionData(),
      })

      // Act: Admin approves
      const approved = await db.submission.update({
        where: { id: submission.id },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
          reviewedByAdminId: 'admin_123',
        },
      })

      // Assert
      expect(approved.status).toBe('approved')
      expect(approved.reviewedAt).toBeDefined()
      expect(approved.reviewedByAdminId).toBe('admin_123')
    })

    it('should update submission to denied', async () => {
      // Arrange
      const submission = await db.submission.create({
        data: createTestSubmissionData(),
      })

      // Act: Admin denies
      const denied = await db.submission.update({
        where: { id: submission.id },
        data: {
          status: 'denied',
          reviewedAt: new Date(),
          reviewedByAdminId: 'admin_456',
        },
      })

      // Assert
      expect(denied.status).toBe('denied')
      expect(denied.reviewedAt).toBeDefined()
      expect(denied.reviewedByAdminId).toBe('admin_456')
    })
  })

  describe('Email Tracking', () => {
    it('should track approval email sent', async () => {
      // Arrange
      const submission = await db.submission.create({
        data: createTestSubmissionData({ status: 'approved' }),
      })

      // Act: Mark email as sent
      const updated = await db.submission.update({
        where: { id: submission.id },
        data: {
          approvalEmailSentAt: new Date(),
        },
      })

      // Assert
      expect(updated.approvalEmailSentAt).toBeDefined()
      expect(updated.denialEmailSentAt).toBeNull()
    })

    it('should track denial email sent', async () => {
      // Arrange
      const submission = await db.submission.create({
        data: createTestSubmissionData({ status: 'denied' }),
      })

      // Act: Mark email as sent
      const updated = await db.submission.update({
        where: { id: submission.id },
        data: {
          denialEmailSentAt: new Date(),
        },
      })

      // Assert
      expect(updated.denialEmailSentAt).toBeDefined()
      expect(updated.approvalEmailSentAt).toBeNull()
    })
  })

  describe('Refund Tracking', () => {
    it('should track refund information', async () => {
      // Arrange
      const submission = await db.submission.create({
        data: createTestSubmissionData(),
      })

      // Act: Process refund
      const refunded = await db.submission.update({
        where: { id: submission.id },
        data: {
          stripeRefundId: 're_test_12345',
          refundedAt: new Date(),
        },
      })

      // Assert
      expect(refunded.stripeRefundId).toBe('re_test_12345')
      expect(refunded.refundedAt).toBeDefined()
    })
  })

  describe('Temporary Submission Expiration', () => {
    it('should identify expired temporary submissions', async () => {
      // Arrange: Create expired and non-expired submissions
      await db.temporarySubmission.create({
        data: createExpiredTempSubmission({
          paymentIntentId: 'pi_expired_1',
        }),
      })

      await db.temporarySubmission.create({
        data: createTestTempSubmissionData({
          paymentIntentId: 'pi_active_1',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future
        }),
      })

      // Act: Query expired submissions
      const expired = await db.temporarySubmission.findMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      })

      // Assert: Only expired one found
      expect(expired).toHaveLength(1)
      expect(expired[0].paymentIntentId).toBe('pi_expired_1')
    })

    it('should delete expired temporary submissions', async () => {
      // Arrange: Create expired submission
      await db.temporarySubmission.create({
        data: createExpiredTempSubmission(),
      })

      // Act: Delete expired
      const result = await db.temporarySubmission.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      })

      // Assert
      expect(result.count).toBeGreaterThan(0)

      const remaining = await db.temporarySubmission.count()
      expect(remaining).toBe(0)
    })
  })

  describe('Querying and Filtering', () => {
    it('should query submissions by multiple criteria', async () => {
      // Arrange: Create multiple submissions
      const now = new Date()
      await Promise.all([
        db.submission.create({
          data: createTestSubmissionData({
            email: 'user1@example.com',
            status: 'pending_review',
            createdAt: now,
          }),
        }),
        db.submission.create({
          data: createTestSubmissionData({
            email: 'user2@example.com',
            status: 'approved',
            createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          }),
        }),
      ])

      // Act: Query pending submissions from today
      const pending = await db.submission.findMany({
        where: {
          status: 'pending_review',
          createdAt: {
            gte: new Date(now.getTime() - 12 * 60 * 60 * 1000),
          },
        },
      })

      // Assert
      expect(pending).toHaveLength(1)
      expect(pending[0].email).toBe('user1@example.com')
    })

    it('should support pagination', async () => {
      // Arrange: Create multiple submissions
      const submissions = createMultipleTestSubmissions(10)
      await Promise.all(submissions.map((data) => db.submission.create({ data })))

      // Act: Paginate results
      const page1 = await db.submission.findMany({
        take: 5,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      })

      const page2 = await db.submission.findMany({
        take: 5,
        skip: 5,
        orderBy: { createdAt: 'desc' },
      })

      // Assert
      expect(page1).toHaveLength(5)
      expect(page2).toHaveLength(5)
      expect(page1[0].id).not.toBe(page2[0].id)
    })

    it('should filter by date range', async () => {
      // Arrange
      const today = new Date()
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

      await Promise.all([
        db.submission.create({
          data: createTestSubmissionData({
            firstDayOff: today,
            lastDayOff: today,
          }),
        }),
        db.submission.create({
          data: createTestSubmissionData({
            firstDayOff: yesterday,
            lastDayOff: yesterday,
          }),
        }),
      ])

      // Act: Find submissions for today
      const todaySubmissions = await db.submission.findMany({
        where: {
          firstDayOff: {
            gte: new Date(today.setHours(0, 0, 0, 0)),
          },
        },
      })

      // Assert
      expect(todaySubmissions).toHaveLength(1)
    })
  })

  describe('Timestamps', () => {
    it('should automatically set createdAt', async () => {
      // Act
      const submission = await db.submission.create({
        data: createTestSubmissionData(),
      })

      // Assert
      expect(submission.createdAt).toBeDefined()
      expect(submission.createdAt).toBeInstanceOf(Date)
    })

    it('should automatically update updatedAt', async () => {
      // Arrange
      const submission = await db.submission.create({
        data: createTestSubmissionData(),
      })

      const originalUpdatedAt = submission.updatedAt

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Act: Update submission
      const updated = await db.submission.update({
        where: { id: submission.id },
        data: { status: 'approved' },
      })

      // Assert: updatedAt changed
      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })
  })
})
