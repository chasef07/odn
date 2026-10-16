import { afterEach, describe, expect, it, vi } from 'vitest'
import { smsStatusLabel } from '../sms-status'
import { isLocalOptOut, isOptInKeyword, sendTransactionalSmsForSubmission } from '../telnyx'

const { mockSmsPhoneStateFindUnique } = vi.hoisted(() => ({
  mockSmsPhoneStateFindUnique: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: { smsPhoneState: { findUnique: mockSmsPhoneStateFindUnique } },
}))

describe('Telnyx SMS helpers', () => {
  it('recognizes local opt-out wording', () => {
    expect(isLocalOptOut('STOP')).toBe(true)
    expect(isLocalOptOut('STOP!')).toBe(true)
    expect(isLocalOptOut('unsubscribe')).toBe(true)
    expect(isLocalOptOut('unsubscribe.')).toBe(true)
    expect(isLocalOptOut('please stop')).toBe(true)
    expect(isLocalOptOut('please dont text me')).toBe(true)
    expect(isLocalOptOut('please don\u2019t text me')).toBe(true)
    expect(isLocalOptOut('please do not text me')).toBe(true)
    expect(isLocalOptOut('my new email is a@example.com')).toBe(false)
  })

  it('recognizes toll-free opt-in keywords', () => {
    expect(isOptInKeyword('START')).toBe(true)
    expect(isOptInKeyword('unstop')).toBe(true)
    expect(isOptInKeyword('yes')).toBe(false)
  })

  it('maps Telnyx delivery states to admin labels', () => {
    expect(smsStatusLabel('queued')).toBe('Queued')
    expect(smsStatusLabel('sent')).toBe('Sent')
    expect(smsStatusLabel('delivered')).toBe('Delivered')
    expect(smsStatusLabel('delivery_failed')).toBe('Failed')
    expect(smsStatusLabel('sending_failed')).toBe('Failed')
    expect(smsStatusLabel('sending')).toBe('Queued')
    expect(smsStatusLabel('undelivered')).toBe('Failed')
    expect(smsStatusLabel('delivery_unconfirmed')).toBe('Unconfirmed')
  })
})

describe('transactional SMS when sending is disabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const submission = {
    id: 'sub_123',
    smsOptIn: true,
    smsPhoneE164: '+15555550100',
  }

  it('logs one skip line with the submission id and no phone number', async () => {
    vi.stubEnv('TELNYX_SMS_ENABLED', 'false')
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    await sendTransactionalSmsForSubmission({ submission, type: 'APPROVAL_SENT', body: 'hello' })

    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith(
      'Transactional SMS skipped because TELNYX_SMS_ENABLED=false:',
      { submissionId: 'sub_123', type: 'APPROVAL_SENT' }
    )
    expect(JSON.stringify(info.mock.calls)).not.toContain('5555550100')
    expect(mockSmsPhoneStateFindUnique).not.toHaveBeenCalled()
    info.mockRestore()
  })

  it('stays quiet for a submission that never opted in', async () => {
    vi.stubEnv('TELNYX_SMS_ENABLED', 'false')
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    await sendTransactionalSmsForSubmission({
      submission: { ...submission, smsOptIn: false },
      type: 'APPROVAL_SENT',
      body: 'hello',
    })

    expect(info).not.toHaveBeenCalled()
    info.mockRestore()
  })
})
