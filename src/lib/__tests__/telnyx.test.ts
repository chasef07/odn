import { describe, expect, it } from 'vitest'
import { smsStatusLabel } from '../sms-status'
import { isLocalOptOut, isOptInKeyword } from '../telnyx'

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
