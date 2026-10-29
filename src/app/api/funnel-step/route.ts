import { NextRequest, NextResponse } from 'next/server'
import { recordFunnelStep } from '@/db/funnel-steps'
import { ATTRIBUTION_COOKIE, parseAttributionCookie } from '@/lib/attribution'
import { parseFunnelStepView } from '@/lib/funnel'

export async function POST(request: NextRequest) {
  const view = parseFunnelStepView(await request.json().catch(() => null))
  if (!view) {
    return NextResponse.json({ error: 'Invalid funnel step' }, { status: 400 })
  }

  const attribution = parseAttributionCookie(request.cookies.get(ATTRIBUTION_COOKIE)?.value)

  try {
    await recordFunnelStep({ ...view, attributionChannel: attribution?.last.channel ?? null })
  } catch (error) {
    console.error('Error recording funnel step:', error)
    return NextResponse.json({ error: 'Could not record funnel step' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
