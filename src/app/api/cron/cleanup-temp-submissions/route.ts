import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import prisma from '@/lib/prisma'

/**
 * Cleanup Job for Expired TemporarySubmissions
 *
 * This endpoint is called by Vercel Cron every hour to delete expired
 * TemporarySubmissions (older than 24 hours).
 *
 * Security: Protected by CRON_SECRET environment variable.
 * Vercel automatically sends this as: Authorization: Bearer ${CRON_SECRET}
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-temp-submissions",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

export async function GET(request: NextRequest) {
  try {
    // 🔒 SECURITY: Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Validate CRON_SECRET is set (should be caught by env validation, but extra safety)
    if (!cronSecret) {
      console.error('❌ CRON_SECRET not configured', {
        timestamp: new Date().toISOString(),
      })
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      )
    }

    const expectedAuth = `Bearer ${cronSecret}`

    // Use timing-safe comparison to prevent timing attacks
    const isValid =
      authHeader &&
      authHeader.length === expectedAuth.length &&
      timingSafeEqual(
        Buffer.from(authHeader),
        Buffer.from(expectedAuth)
      )

    if (!isValid) {
      console.error('❌ Unauthorized cron job attempt', {
        timestamp: new Date().toISOString(),
        hasAuthHeader: !!authHeader,
        ip: request.headers.get('x-forwarded-for'),
      })

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // ✅ Authorized - proceed with cleanup
    // Delete expired TemporarySubmissions
    const result = await prisma.temporarySubmission.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(), // Less than current time
        },
      },
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Cron job completed: Cleaned up ${result.count} expired TemporarySubmissions`, {
        deleted: result.count,
        timestamp: new Date().toISOString(),
      })
    }

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
