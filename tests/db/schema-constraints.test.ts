import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { getTestDb, initTestDb, closeTestDb, cleanTestDb } from '../setup/db-helpers'
import { createTestSubmissionData, createTestTempSubmissionData } from '../setup/test-data-factory'

describe('Database Schema Constraints', () => {
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

  describe('Submission Constraints', () => {
    it('should enforce unique constraint on stripePaymentIntentId', async () => {
      // Arrange: Create first submission
      const paymentIntentId = `pi_test_unique_${Date.now()}`
      await db.submission.create({
        data: createTestSubmissionData({
          stripePaymentIntentId: paymentIntentId,
        }),
      })

      // Act & Assert: Try to create duplicate
      await expect(
        db.submission.create({
          data: createTestSubmissionData({
            stripePaymentIntentId: paymentIntentId, // Same payment intent
            email: 'different@example.com', // Different email
          }),
        })
      ).rejects.toThrow()
    })

    it('should allow null values for optional fields', async () => {
      // Act: Create submission with minimal fields
      const submission = await db.submission.create({
        data: {
          stripePaymentIntentId: `pi_test_minimal_${Date.now()}`,
          status: 'pending_review',
          state: 'CA',
          recipient: 'myself',
          patientFirstName: 'Test',
          patientLastName: 'User',
          patientDateOfBirth: new Date('1990-01-01'),
          email: `test-${Date.now()}@example.com`,
          phone: '5555551234',
          notePurpose: 'work',
          firstDayOff: new Date('2025-11-01'),
          lastDayOff: new Date('2025-11-02'),
          absenceReason: 'Feeling sick',
          // All optional fields omitted
        },
      })

      // Assert: Optional fields are null
      expect(submission.guardianFirstName).toBeNull()
      expect(submission.guardianLastName).toBeNull()
      expect(submission.guardianDateOfBirth).toBeNull()
      expect(submission.otherNotePurpose).toBeNull()
      expect(submission.otherAbsenceReason).toBeNull()
      expect(submission.symptoms).toBeNull()
      expect(submission.otherSymptomText).toBeNull()
      expect(submission.additionalInformation).toBeNull()
    })

    it('should require all mandatory fields', async () => {
      // Act & Assert: Try to create submission without required field
      await expect(
        db.submission.create({
          data: {
            stripePaymentIntentId: `pi_test_${Date.now()}`,
            // Missing 'status' field (has default)
            state: 'CA',
            recipient: 'myself',
            // Missing patientFirstName (required)
            patientLastName: 'User',
            patientDateOfBirth: new Date('1990-01-01'),
            email: 'test@example.com',
            phone: '5555551234',
            notePurpose: 'work',
            firstDayOff: new Date('2025-11-01'),
            lastDayOff: new Date('2025-11-02'),
            absenceReason: 'Feeling sick',
          } as Prisma.SubmissionCreateInput,
        })
      ).rejects.toThrow()
    })

    it('should store JSON fields correctly', async () => {
      // Arrange
      const symptoms = ['Fever', 'Cough', 'Headache']

      // Act: Create submission with JSON symptoms
      const submission = await db.submission.create({
        data: createTestSubmissionData({
          symptoms: symptoms as any,
        }),
      })

      // Assert: JSON stored and retrieved correctly
      expect(submission.symptoms).toEqual(symptoms)
    })

    it('should handle date fields correctly', async () => {
      // Arrange
      const dob = new Date('1990-01-15')
      const firstDay = new Date('2025-11-01')
      const lastDay = new Date('2025-11-05')

      // Act
      const submission = await db.submission.create({
        data: createTestSubmissionData({
          patientDateOfBirth: dob,
          firstDayOff: firstDay,
          lastDayOff: lastDay,
        }),
      })

      // Assert: Dates stored correctly
      expect(submission.patientDateOfBirth).toBeInstanceOf(Date)
      expect(submission.firstDayOff).toBeInstanceOf(Date)
      expect(submission.lastDayOff).toBeInstanceOf(Date)
    })
  })

  describe('TemporarySubmission Constraints', () => {
    it('should enforce unique constraint on paymentIntentId', async () => {
      // Arrange: Create first temp submission
      const paymentIntentId = `pi_test_temp_unique_${Date.now()}`
      await db.temporarySubmission.create({
        data: createTestTempSubmissionData({
          paymentIntentId,
        }),
      })

      // Act & Assert: Try to create duplicate
      await expect(
        db.temporarySubmission.create({
          data: createTestTempSubmissionData({
            paymentIntentId, // Same payment intent
          }),
        })
      ).rejects.toThrow()
    })

    it('should store form data as JSON', async () => {
      // Arrange
      const formData = {
        state: 'CA',
        email: 'test@example.com',
        patientFirstName: 'Test',
        custom: { nested: 'data' },
      }

      // Act
      const tempSubmission = await db.temporarySubmission.create({
        data: {
          paymentIntentId: `pi_test_json_${Date.now()}`,
          formData: formData as any,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })

      // Assert: JSON stored and retrieved correctly
      expect(tempSubmission.formData).toMatchObject(formData)
    })

    it('should handle expiration dates correctly', async () => {
      // Arrange
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      // Act
      const tempSubmission = await db.temporarySubmission.create({
        data: createTestTempSubmissionData({
          expiresAt,
        }),
      })

      // Assert
      expect(tempSubmission.expiresAt).toBeInstanceOf(Date)
      expect(tempSubmission.expiresAt.getTime()).toBeCloseTo(expiresAt.getTime(), -2)
    })
  })

  describe('Indexes and Queries', () => {
    it('should query by status efficiently (indexed)', async () => {
      // Arrange: Create multiple submissions with different statuses
      await Promise.all([
        db.submission.create({
          data: createTestSubmissionData({ status: 'approved' }),
        }),
        db.submission.create({
          data: createTestSubmissionData({ status: 'pending_review' }),
        }),
        db.submission.create({
          data: createTestSubmissionData({ status: 'denied' }),
        }),
      ])

      // Act: Query by status
      const pending = await db.submission.findMany({
        where: { status: 'pending_review' },
      })

      // Assert
      expect(pending).toHaveLength(1)
      expect(pending[0].status).toBe('pending_review')
    })

    it('should query by email efficiently (indexed)', async () => {
      // Arrange
      const email = `unique-${Date.now()}@example.com`
      await db.submission.create({
        data: createTestSubmissionData({ email }),
      })

      // Act
      const submissions = await db.submission.findMany({
        where: { email },
      })

      // Assert
      expect(submissions).toHaveLength(1)
      expect(submissions[0].email).toBe(email)
    })

    it('should query by createdAt efficiently (indexed)', async () => {
      // Arrange: Create submissions with different timestamps
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      await db.submission.create({
        data: createTestSubmissionData({
          createdAt: yesterday,
        }),
      })
      await db.submission.create({
        data: createTestSubmissionData({
          createdAt: now,
        }),
      })

      // Act: Query recent submissions
      const recent = await db.submission.findMany({
        where: {
          createdAt: {
            gte: new Date(now.getTime() - 12 * 60 * 60 * 1000), // Last 12 hours
          },
        },
      })

      // Assert
      expect(recent).toHaveLength(1)
    })

    it('should query by composite index (status + createdAt)', async () => {
      // Arrange
      const now = new Date()
      await Promise.all([
        db.submission.create({
          data: createTestSubmissionData({ status: 'pending_review', createdAt: now }),
        }),
        db.submission.create({
          data: createTestSubmissionData({
            status: 'approved',
            createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          }),
        }),
      ])

      // Act: Query with composite index
      const pendingRecent = await db.submission.findMany({
        where: {
          status: 'pending_review',
          createdAt: {
            gte: new Date(now.getTime() - 12 * 60 * 60 * 1000),
          },
        },
      })

      // Assert
      expect(pendingRecent).toHaveLength(1)
      expect(pendingRecent[0].status).toBe('pending_review')
    })
  })
})
