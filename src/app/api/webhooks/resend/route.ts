import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendBounceAlertEmail, resend } from '@/lib/email'

interface ResendBounceEvent {
  type: 'email.bounced'
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    bounce_reason?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Get raw body and webhook headers
    const body = await request.text()
    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('Missing Svix headers')
      return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 })
    }

    // 2. Verify signature using Resend SDK
    let event: ResendBounceEvent
    try {
      event = resend.webhooks.verify({
        payload: body,
        headers: {
          id: svixId,
          timestamp: svixTimestamp,
          signature: svixSignature,
        },
        webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
      }) as ResendBounceEvent
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // 3. Filter for bounce events only
    if (event.type !== 'email.bounced') {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    if (process.env.NODE_ENV === 'development') {
      console.info('Processing email bounce:', {
        to: event.data.to[0],
        subject: event.data.subject,
        reason: event.data.bounce_reason,
      })
    }

    // 4. Extract bounce data
    const bouncedEmail = event.data.to[0]
    const bounceReason = event.data.bounce_reason || 'Unknown reason'
    const emailSubject = event.data.subject

    // 5. Identify email type from subject
    let emailType: 'approval' | 'denial' | 'payment_confirmation' | 'unknown' = 'unknown'
    if (emailSubject.includes("Your Doctor's Note is Approved")) {
      emailType = 'approval'
    } else if (emailSubject.includes('Payment Confirmed')) {
      emailType = 'payment_confirmation'
    } else if (emailSubject.includes("Your Doctor's Note Request - Update")) {
      emailType = 'denial'
    }

    // 6. Query submission by email (most recent)
    let submission = null
    try {
      submission = await prisma.submission.findFirst({
        where: { email: bouncedEmail.toLowerCase() },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          patientFirstName: true,
          patientLastName: true,
          email: true,
          phone: true,
          status: true,
        },
      })
    } catch (dbError) {
      console.error('Database query error:', dbError)
      // Continue without submission data - we'll send alert anyway
    }

    // 7. Send alert email (non-blocking)
    try {
      await sendBounceAlertEmail({
        bouncedEmail,
        bounceReason,
        emailType,
        submission: submission || null,
      })
      if (process.env.NODE_ENV === 'development') {
        console.info('Bounce alert email sent successfully')
      }
    } catch (emailError) {
      // Log error but still return 200 OK to prevent retries
      console.error('Failed to send bounce alert email:', emailError)
      return NextResponse.json({ received: true, warning: 'Alert email failed' }, { status: 200 })
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
