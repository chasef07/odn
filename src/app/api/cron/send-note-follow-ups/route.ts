import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runFollowUpEmailJob } from '@/lib/follow-up-email-job'
import { env } from '@/lib/env'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${env.CRON_SECRET}`
  const authorized =
    authHeader !== null &&
    authHeader.length === expectedAuth.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth))

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runFollowUpEmailJob()
    if (result.failed > 0) {
      return NextResponse.json({ success: false, ...result }, { status: 500 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Note follow-up job failed:', error)
    return NextResponse.json({ success: false, error: 'Follow-up job failed' }, { status: 500 })
  }
}
