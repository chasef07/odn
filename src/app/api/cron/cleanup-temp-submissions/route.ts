import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Cleanup Job for Expired TemporarySubmissions
 *
 * This endpoint should be called by a cron job (e.g., Vercel Cron)
 * to delete expired TemporarySubmissions (older than 24 hours).
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-temp-submissions",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

export async function GET() {
  try {
    // Delete expired TemporarySubmissions
    const result = await prisma.temporarySubmission.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(), // Less than current time
        },
      },
    })

    console.log(`✅ Cleaned up ${result.count} expired TemporarySubmissions`)

    return NextResponse.json({
      success: true,
      deleted: result.count,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Cleanup job error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Cleanup failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
