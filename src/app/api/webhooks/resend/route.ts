import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendBounceAlertEmail, resend } from '@/lib/email'
import { env } from '@/lib/env'
import { emailBounceSms } from '@/lib/sms-templates'
import { sendTransactionalSmsForSubmission } from '@/lib/telnyx'
import { isUniqueConstraintError } from '@/lib/prisma-errors'

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
    const body = await request.text()
    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('Missing Svix headers')
      return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 })
    }

    let event: ResendBounceEvent
    try {
      event = resend.webhooks.verify({
        payload: body,
        headers: {
          id: svixId,
          timestamp: svixTimestamp,
          signature: svixSignature,
        },
        webhookSecret: env.RESEND_WEBHOOK_SECRET,
      }) as ResendBounceEvent
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    if (event.type !== 'email.bounced') {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const claimedEvent = await claimResendWebhookEvent({
      id: svixId,
      emailId: event.data.email_id,
      eventType: event.type,
    })

    if (!claimedEvent) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    if (process.env.NODE_ENV === 'development') {
      console.info('Processing email bounce:', {
        to: event.data.to[0],
        subject: event.data.subject,
        reason: event.data.bounce_reason,
      })
    }

    const bouncedEmail = event.data.to[0]
    const bounceReason = event.data.bounce_reason || 'Unknown reason'
    const emailSubject = event.data.subject

    let emailType: 'approval' | 'denial' | 'payment_confirmation' | 'follow_up' | 'unknown' =
      'unknown'
    if (emailSubject.includes("Your Doctor's Note is Approved")) {
      emailType = 'approval'
    } else if (emailSubject.includes('Payment Confirmed')) {
      emailType = 'payment_confirmation'
    } else if (emailSubject.includes("Your Doctor's Note Request - Update")) {
      emailType = 'denial'
    } else if (emailSubject.includes('A thank-you discount from OnlineDoctorNote')) {
      emailType = 'follow_up'
    }

    let submission = null
    let canSendBounceSms = false
    try {
      const matchingSubmissions = await prisma.submission.findMany({
        where: { email: bouncedEmail.toLowerCase() },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: {
          id: true,
          patientFirstName: true,
          patientLastName: true,
          email: true,
          phone: true,
          smsOptIn: true,
          smsPhoneE164: true,
          status: true,
        },
      })
      submission = matchingSubmissions[0] || null
      canSendBounceSms = matchingSubmissions.length === 1
    } catch (dbError) {
      console.error('Database query error:', dbError)
    }

    if (canSendBounceSms && submission?.smsOptIn) {
      await sendTransactionalSmsForSubmission({
        submission,
        type: 'EMAIL_BOUNCE',
        body: emailBounceSms(),
      }).catch((smsError) => {
        console.warn('Failed to send transactional SMS (non-critical):', {
          submissionId: submission.id,
          type: 'EMAIL_BOUNCE',
          error: smsError instanceof Error ? smsError.message : 'Unknown SMS error',
        })
      })
    }

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
      console.error('Failed to send bounce alert email:', emailError)
      return NextResponse.json({ received: true, warning: 'Alert email failed' }, { status: 200 })
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function claimResendWebhookEvent({
  id,
  emailId,
  eventType,
}: {
  id: string
  emailId?: string
  eventType: string
}): Promise<boolean> {
  try {
    await prisma.resendWebhookEvent.create({
      data: {
        id,
        emailId,
        eventType,
      },
    })
    return true
  } catch (error) {
    if (isUniqueConstraintError(error)) return false
    throw error
  }
}
