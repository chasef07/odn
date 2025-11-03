import { PrismaClient } from '@prisma/client'

// Singleton test database client
let testPrisma: PrismaClient | null = null

/**
 * Get or create test database client
 */
export function getTestDb(): PrismaClient {
  if (!testPrisma) {
    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'file:./test.db',
        },
      },
      log: [], // Disable logging in tests for cleaner output
    })
  }
  return testPrisma
}

/**
 * Initialize test database - connect to existing database
 */
export async function initTestDb(): Promise<void> {
  try {
    // Get database client and connect
    const db = getTestDb()
    await db.$connect()

    // Clean any existing test data
    await cleanTestDb()
  } catch (error) {
    console.error('Failed to initialize test database:', error)
    throw error
  }
}

/**
 * Clean all data from test database
 */
export async function cleanTestDb(): Promise<void> {
  const db = getTestDb()

  try {
    // Delete in correct order (children first)
    await db.temporarySubmission.deleteMany()
    await db.submission.deleteMany()
  } catch (error) {
    console.error('Failed to clean test database:', error)
    throw error
  }
}

/**
 * Close test database connection
 */
export async function closeTestDb(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect()
    testPrisma = null
  }
}

/**
 * Reset test database - clean all data and reinitialize
 * Use this between test suites for a completely clean state
 */
export async function resetTestDb(): Promise<void> {
  await cleanTestDb()
  await closeTestDb()
  await initTestDb()
}

/**
 * Seed test database with sample data
 * Useful for manual testing or specific test scenarios
 */
export async function seedTestDb(): Promise<void> {
  const db = getTestDb()

  // Create a sample submission
  await db.submission.create({
    data: {
      stripePaymentIntentId: 'pi_test_seed_12345',
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
      symptoms: ['Fever', 'Cough'],
    },
  })

  // Create a sample temporary submission (not expired)
  await db.temporarySubmission.create({
    data: {
      paymentIntentId: 'pi_test_temp_12345',
      formData: {
        state: 'NY',
        recipient: 'myself',
        patientFirstName: 'Temp',
        patientLastName: 'Test',
        email: 'temp@example.com',
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    },
  })
}

/**
 * Get count of records in all tables
 * Useful for debugging and verification
 */
export async function getTestDbCounts(): Promise<{
  submissions: number
  temporarySubmissions: number
}> {
  const db = getTestDb()

  const [submissions, temporarySubmissions] = await Promise.all([
    db.submission.count(),
    db.temporarySubmission.count(),
  ])

  return { submissions, temporarySubmissions }
}
