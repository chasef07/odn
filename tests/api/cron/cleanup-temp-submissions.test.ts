import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getTestDb, initTestDb, closeTestDb, cleanTestDb } from '../../setup/db-helpers'
import { createTestTempSubmissionData, createExpiredTempSubmission } from '../../setup/test-data-factory'
import { GET } from '@/app/api/cron/cleanup-temp-submissions/route'

describe('Cron: Cleanup Temporary Submissions', () => {
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

  // Helper to create mock request
  function createMockRequest(): NextRequest {
    return {
      url: 'http://localhost:3000/api/cron/cleanup-temp-submissions',
    } as NextRequest
  }

  describe('Basic Cleanup', () => {
    it('should delete expired temporary submissions', async () => {
      // Arrange: Create expired submissions
      await db.temporarySubmission.createMany({
        data: [
          createExpiredTempSubmission({ paymentIntentId: 'pi_expired_1' }),
          createExpiredTempSubmission({ paymentIntentId: 'pi_expired_2' }),
          createExpiredTempSubmission({ paymentIntentId: 'pi_expired_3' }),
        ],
      })

      const beforeCount = await db.temporarySubmission.count()
      expect(beforeCount).toBe(3)

      // Act: Run cleanup
      const request = createMockRequest()
      const response = await GET(request)
      const result = await response.json()

      // Assert: All expired submissions deleted
      expect(response.status).toBe(200)
      expect(result.deleted).toBe(3)

      const afterCount = await db.temporarySubmission.count()
      expect(afterCount).toBe(0)
    })

    it('should preserve non-expired temporary submissions', async () => {
      // Arrange: Create mix of expired and non-expired
      await db.temporarySubmission.createMany({
        data: [
          createExpiredTempSubmission({ paymentIntentId: 'pi_expired_1' }),
          createTestTempSubmissionData({
            paymentIntentId: 'pi_active_1',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future
          }),
          createTestTempSubmissionData({
            paymentIntentId: 'pi_active_2',
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // Future
          }),
        ],
      })

      const beforeCount = await db.temporarySubmission.count()
      expect(beforeCount).toBe(3)

      // Act: Run cleanup
      const request = createMockRequest()
      const response = await GET(request)
      const result = await response.json()

      // Assert: Only expired deleted, active preserved
      expect(result.deleted).toBe(1)

      const afterCount = await db.temporarySubmission.count()
      expect(afterCount).toBe(2)

      // Verify active submissions still exist
      const activeSubmissions = await db.temporarySubmission.findMany()
      const paymentIntentIds = activeSubmissions.map((s) => s.paymentIntentId)
      expect(paymentIntentIds).toContain('pi_active_1')
      expect(paymentIntentIds).toContain('pi_active_2')
      expect(paymentIntentIds).not.toContain('pi_expired_1')
    })

    it('should handle empty table gracefully', async () => {
      // Arrange: No temporary submissions exist
      const beforeCount = await db.temporarySubmission.count()
      expect(beforeCount).toBe(0)

      // Act: Run cleanup
      const request = createMockRequest()
      const response = await GET(request)
      const result = await response.json()

      // Assert: Success with 0 deleted
      expect(response.status).toBe(200)
      expect(result.deleted).toBe(0)
      expect(result.message).toContain('Cleanup completed')
    })
  })

  describe('Edge Cases', () => {
    it('should handle submission expiring exactly at current time', async () => {
      // Arrange: Create submission expiring now
      const now = new Date()
      await db.temporarySubmission.create({
        data: createTestTempSubmissionData({
          paymentIntentId: 'pi_expiring_now',
          expiresAt: now,
        }),
      })

      // Small delay to ensure "now" is in the past
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Act: Run cleanup
      const request = createMockRequest()
      const response = await GET(request)
      const result = await response.json()

      // Assert: Deleted
      expect(result.deleted).toBe(1)
    })

    it('should handle large number of expired submissions', async () => {
      // Arrange: Create many expired submissions
      const count = 50
      const submissions = Array.from({ length: count }, (_, i) =>
        createExpiredTempSubmission({
          paymentIntentId: `pi_expired_${i}`,
        })
      )

      await db.temporarySubmission.createMany({ data: submissions })

      // Act: Run cleanup
      const request = createMockRequest()
      const response = await GET(request)
      const result = await response.json()

      // Assert: All deleted
      expect(result.deleted).toBe(count)

      const afterCount = await db.temporarySubmission.count()
      expect(afterCount).toBe(0)
    })

    it('should only delete expired submissions (not touch permanent submissions)', async () => {
      // Arrange: Create expired temp submission AND permanent submission
      await db.temporarySubmission.create({
        data: createExpiredTempSubmission({ paymentIntentId: 'pi_expired' }),
      })

      await db.submission.create({
        data: {
          stripePaymentIntentId: 'pi_permanent',
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

      const beforePermanent = await db.submission.count()
      expect(beforePermanent).toBe(1)

      // Act: Run cleanup
      const request = createMockRequest()
      const response = await GET(request)
      const result = await response.json()

      // Assert: Temp deleted, permanent untouched
      expect(result.deleted).toBe(1)

      const afterPermanent = await db.submission.count()
      expect(afterPermanent).toBe(1) // Permanent submission still exists
    })
  })

  describe('Response Format', () => {
    it('should return correct response format', async () => {
      // Arrange
      await db.temporarySubmission.createMany({
        data: [
          createExpiredTempSubmission({ paymentIntentId: 'pi_1' }),
          createExpiredTempSubmission({ paymentIntentId: 'pi_2' }),
        ],
      })

      // Act
      const request = createMockRequest()
      const response = await GET(request)
      const result = await response.json()

      // Assert: Response has correct shape
      expect(result).toHaveProperty('deleted')
      expect(result).toHaveProperty('message')
      expect(typeof result.deleted).toBe('number')
      expect(typeof result.message).toBe('string')
      expect(result.deleted).toBe(2)
    })

    it('should return 200 status on success', async () => {
      // Act
      const request = createMockRequest()
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
    })
  })

  describe('Idempotency', () => {
    it('should be safe to run multiple times', async () => {
      // Arrange: Create expired submissions
      await db.temporarySubmission.createMany({
        data: [
          createExpiredTempSubmission({ paymentIntentId: 'pi_1' }),
          createExpiredTempSubmission({ paymentIntentId: 'pi_2' }),
        ],
      })

      const request = createMockRequest()

      // Act: Run cleanup twice
      const response1 = await GET(request)
      const result1 = await response1.json()

      const response2 = await GET(request)
      const result2 = await response2.json()

      // Assert: First run deletes, second run finds nothing
      expect(result1.deleted).toBe(2)
      expect(result2.deleted).toBe(0)

      const finalCount = await db.temporarySubmission.count()
      expect(finalCount).toBe(0)
    })
  })
})
