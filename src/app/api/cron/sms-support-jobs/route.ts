import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { processQueuedSmsSupportJobs } from '@/lib/sms-support-jobs'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('CRON_SECRET not configured for SMS support jobs')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const expectedAuth = `Bearer ${cronSecret}`
  const isValid =
    authHeader &&
    authHeader.length === expectedAuth.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth))

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processQueuedSmsSupportJobs({
      limit: 5,
      workerId: `cron-${Date.now()}`,
    })

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('SMS support job runner failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'SMS support job runner failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
