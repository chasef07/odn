import { createPublicKey, verify } from 'crypto'
import prisma from '@/lib/prisma'
import { telnyxSmsSender } from '@/lib/env'
import { toE164UsPhone } from '@/lib/phone-utils'
export { smsStatusLabel } from '@/lib/sms-status'
import type { SmsMessageType } from '@/lib/sms-templates'

const TELNYX_MESSAGES_URL = 'https://api.telnyx.com/v2/messages'
const ED25519_SPKI_PREFIX = '302a300506032b6570032100'
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60

type SmsEligibleSubmission = {
  smsOptIn: boolean
  smsPhoneE164?: string | null
  phone?: string | null
}

type TransactionalSmsSubmission = SmsEligibleSubmission & {
  id: string
}

export type SendTelnyxSmsInput = {
  submissionId?: string
  supportTicketId?: string
  type: SmsMessageType
  toPhone: string
  body: string
}

type TelnyxError = {
  code?: string
  title?: string
  detail?: string
}

export function normalizeSmsKeyword(body: string): string {
  return body
    .trim()
    .replace(/[^\p{L}\p{N}'\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export function isLocalOptOut(body: string): boolean {
  const normalized = normalizeSmsKeyword(body)
  const words = normalized.split(' ')
  return (
    ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].some((word) =>
      words.includes(word)
    ) ||
    normalized.includes('STOP TEXT') ||
    normalized.includes('STOP SMS') ||
    normalized.includes("DON'T TEXT") ||
    normalized.includes('DONT TEXT') ||
    normalized.includes('DON T TEXT') ||
    normalized.includes('DO NOT TEXT')
  )
}

export function isOptInKeyword(body: string): boolean {
  const normalized = normalizeSmsKeyword(body)
  return normalized === 'START' || normalized === 'UNSTOP'
}

export async function shouldSendTransactionalSms(
  submission: SmsEligibleSubmission
): Promise<boolean> {
  if (!submission.smsOptIn) return false

  const toPhone = submission.smsPhoneE164 || toE164UsPhone(submission.phone)
  if (!toPhone) return false

  const phoneState = await prisma.smsPhoneState.findUnique({
    where: { phoneE164: toPhone },
    select: { optedOutAt: true },
  })

  return !phoneState?.optedOutAt
}

export async function sendTelnyxSms(input: SendTelnyxSmsInput): Promise<{
  success: boolean
  providerMessageId?: string
  error?: string
}> {
  const sender = telnyxSmsSender()
  const to = toE164UsPhone(input.toPhone)

  if (!sender) {
    return { success: false, error: 'Telnyx SMS is disabled (TELNYX_SMS_ENABLED=false)' }
  }
  const { apiKey, from } = sender

  if (!to) {
    return { success: false, error: 'Invalid SMS phone number' }
  }

  const message = await prisma.smsMessage.create({
    data: {
      submissionId: input.submissionId,
      supportTicketId: input.supportTicketId,
      type: input.type,
      direction: 'outbound',
      to,
      from,
      body: input.body,
      providerStatus: 'queued',
    },
  })

  try {
    const response = await fetch(TELNYX_MESSAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        text: input.body,
      }),
      signal: AbortSignal.timeout(5000),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      const providerError = firstTelnyxError(payload)
      await prisma.smsMessage.update({
        where: { id: message.id },
        data: {
          providerStatus: 'sending_failed',
          errorCode: providerError.code || String(response.status),
          errorMessage: providerError.detail || providerError.title || response.statusText,
          finalizedAt: new Date(),
        },
      })

      return {
        success: false,
        error: providerError.detail || providerError.title || response.statusText,
      }
    }

    const providerMessage = payload.data || {}
    const status = providerMessage.to?.[0]?.status || 'queued'

    await prisma.smsMessage.update({
      where: { id: message.id },
      data: {
        providerMessageId: providerMessage.id,
        providerStatus: status,
        sentAt: providerMessage.sent_at ? new Date(providerMessage.sent_at) : new Date(),
      },
    })

    return {
      success: true,
      providerMessageId: providerMessage.id,
    }
  } catch (error) {
    await prisma.smsMessage.update({
      where: { id: message.id },
      data: {
        providerStatus: 'sending_failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown Telnyx send error',
        finalizedAt: new Date(),
      },
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Telnyx send error',
    }
  }
}

export async function sendTransactionalSmsForSubmission({
  submission,
  type,
  body,
}: {
  submission: TransactionalSmsSubmission
  type: SmsMessageType
  body: string
}): Promise<void> {
  try {
    if (!telnyxSmsSender()) {
      if (submission.smsOptIn) {
        console.info('Transactional SMS skipped because TELNYX_SMS_ENABLED=false:', {
          submissionId: submission.id,
          type,
        })
      }
      return
    }
    if (!(await shouldSendTransactionalSms(submission))) return

    const toPhone = submission.smsPhoneE164 || toE164UsPhone(submission.phone)
    if (!toPhone) return

    const result = await sendTelnyxSms({
      submissionId: submission.id,
      type,
      toPhone,
      body,
    })

    if (!result.success) {
      console.warn('Transactional SMS failed:', {
        submissionId: submission.id,
        type,
        error: result.error,
      })
    }
  } catch (error) {
    console.warn('Transactional SMS failed:', {
      submissionId: submission.id,
      type,
      error: error instanceof Error ? error.message : 'Unknown SMS error',
    })
  }
}

export function verifyTelnyxWebhookSignature({
  rawBody,
  signature,
  timestamp,
  publicKey,
  now = new Date(),
}: {
  rawBody: string
  signature: string | null
  timestamp: string | null
  publicKey: string | undefined
  now?: Date
}): boolean {
  if (!signature || !timestamp || !publicKey) return false

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds)) return false

  const ageSeconds = Math.abs(now.getTime() / 1000 - timestampSeconds)
  if (ageSeconds > WEBHOOK_TOLERANCE_SECONDS) return false

  const publicKeyBytes = parsePublicKey(publicKey)
  if (!publicKeyBytes) return false

  try {
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from(ED25519_SPKI_PREFIX, 'hex'), publicKeyBytes]),
      format: 'der',
      type: 'spki',
    })

    return verify(
      null,
      Buffer.from(`${timestamp}|${rawBody}`),
      key,
      Buffer.from(signature, 'base64')
    )
  } catch {
    return false
  }
}

function parsePublicKey(publicKey: string): Buffer | null {
  const trimmed = publicKey.trim()
  const hex = /^[a-fA-F0-9]{64}$/.test(trimmed) ? Buffer.from(trimmed, 'hex') : null
  if (hex?.length === 32) return hex

  try {
    const base64 = Buffer.from(trimmed, 'base64')
    return base64.length === 32 ? base64 : null
  } catch {
    return null
  }
}

function firstTelnyxError(payload: { errors?: TelnyxError[] }): TelnyxError {
  return payload.errors?.[0] || {}
}
