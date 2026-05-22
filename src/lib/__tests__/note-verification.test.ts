import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatDisplayDate,
  generateMedicalRecordNumber,
  generateVerificationSlug,
  getConfiguredPhysician,
  getPatientInitials,
  getReturnGuidance,
  normalizeMedicalRecordNumber,
} from '@/lib/note-verification'
import { checkVerificationLookupLimit } from '@/lib/verification-rate-limit'

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

  it('formats patient initials without exposing the full name', () => {
    expect(getPatientInitials('Jane', 'Doe')).toBe('J.D.')
  })

  it('formats return guidance from the approved last day off', () => {
    const lastDayOff = new Date(Date.UTC(2026, 3, 4))

    expect(formatDisplayDate(lastDayOff)).toBe('April 4, 2026')
    expect(getReturnGuidance(lastDayOff)).toBe('May return after April 4, 2026')
  })

  it('uses the configured default NPI when no env override is provided', () => {
    vi.stubEnv('DOCTOR_NPI', '')

    expect(getConfiguredPhysician().npi).toBe('1558307702')
  })
})

describe('verification lookup rate limit', () => {
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
