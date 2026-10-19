import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  generateMedicalRecordNumber,
  generateVerificationSlug,
  getConfiguredPhysician,
  getPatientInitials,
  getReturnGuidance,
  normalizeMedicalRecordNumber,
  parseIssueDateInput,
} from '@/lib/note-verification'
import { checkVerificationLookupLimit, getRateLimitKey } from '@/lib/verification-rate-limit'

describe('note verification helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('generates a human-friendly medical record number', () => {
    const recordNumber = generateMedicalRecordNumber()

    expect(recordNumber).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
  })

  it('generates an unguessable URL-safe verification slug', () => {
    const slug = generateVerificationSlug()

    expect(slug).toMatch(/^v_[A-Za-z0-9_-]{24}$/)
  })

  it('normalizes pasted medical record numbers', () => {
    expect(normalizeMedicalRecordNumber(' a7b3 c9d2 ')).toBe('A7B3C9D2')
    expect(normalizeMedicalRecordNumber('a7b3-c9d2')).toBe('A7B3C9D2')
    expect(normalizeMedicalRecordNumber('ph-2026-a7b3c9d2')).toBe('A7B3C9D2')
  })

  it('issues on the evaluation date, or on today in ET when none is given', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-17T02:30:00Z'))
    expect(parseIssueDateInput('2026-10-12').toISOString()).toBe('2026-10-12T00:00:00.000Z')
    expect(parseIssueDateInput().toISOString()).toBe('2026-10-16T00:00:00.000Z')
    expect(parseIssueDateInput('').toISOString()).toBe('2026-10-16T00:00:00.000Z')
    vi.useRealTimers()
  })

  it('refuses an evaluation date that is not a real day instead of issuing today', () => {
    expect(() => parseIssueDateInput('2027-02-29')).toThrow('Invalid evaluation date: 2027-02-29')
    expect(() => parseIssueDateInput('10/12/2026')).toThrow('Invalid evaluation date: 10/12/2026')
  })

  it('refuses an evaluation date before 1900', () => {
    expect(() => parseIssueDateInput('0050-01-01')).toThrow('Invalid evaluation date: 0050-01-01')
    expect(() => parseIssueDateInput('1899-12-31')).toThrow('Invalid evaluation date: 1899-12-31')
    expect(parseIssueDateInput('1900-01-01').toISOString()).toBe('1900-01-01T00:00:00.000Z')
  })

  it('formats patient initials without exposing the full name', () => {
    expect(getPatientInitials('Jane', 'Doe')).toBe('J.D.')
  })

  it('formats return guidance from the approved last day off', () => {
    const lastDayOff = new Date(Date.UTC(2026, 3, 4))

    expect(getReturnGuidance(lastDayOff)).toBe('May return after April 4, 2026')
  })

  it('uses the configured default NPI when no env override is provided', () => {
    vi.stubEnv('DOCTOR_NPI', '')

    expect(getConfiguredPhysician().npi).toBe('1558307702')
  })
})

describe('verification lookup rate limit', () => {
  it('returns null when no requester IP is available', () => {
    expect(getRateLimitKey(null)).toBeNull()
    expect(getRateLimitKey('   ')).toBeNull()
  })
  it('blocks repeated manual lookup attempts within the window', () => {
    const now = Date.UTC(2026, 4, 22)
    const key = `test-${now}`

    for (let i = 0; i < 12; i++) {
      expect(checkVerificationLookupLimit(key, now)).toBe(true)
    }

    expect(checkVerificationLookupLimit(key, now)).toBe(false)
    expect(checkVerificationLookupLimit(key, now + 10 * 60 * 1000 + 1)).toBe(true)
  })
})
