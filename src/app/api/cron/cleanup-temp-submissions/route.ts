import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import prisma from '@/lib/prisma'
import { env } from '@/lib/env'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${env.CRON_SECRET}`

    const isValid =
      authHeader &&
      authHeader.length === expectedAuth.length &&
      timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth))

    if (!isValid) {
      console.error('❌ Unauthorized cron job attempt', {
        timestamp: new Date().toISOString(),
        hasAuthHeader: !!authHeader,
        ip: request.headers.get('x-forwarded-for'),
      })

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let result
    let retries = 3
    let lastError

    for (let i = 0; i < retries; i++) {
      try {
        result = await prisma.temporarySubmission.deleteMany({
          where: {
            expiresAt: {
              lt: new Date(),
            },
          },
        })

        break
      } catch (error) {
        lastError = error
        console.error(`❌ Cleanup attempt ${i + 1}/${retries} failed:`, error)

        if (i < retries - 1) {
          const waitTime = 1000 * Math.pow(2, i)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
      }
    }

    if (!result) {
      console.error('❌ All cleanup retries failed', {
        retries,
        lastError,
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Cleanup failed after retries',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

    if (process.env.NODE_ENV === 'development') {
      console.info(
        `✅ Cron job completed: Cleaned up ${result.count} expired TemporarySubmissions`,
        {
          deleted: result.count,
          timestamp: new Date().toISOString(),
        }
      )
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
