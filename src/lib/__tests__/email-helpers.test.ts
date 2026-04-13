import { describe, it, expect } from 'vitest'
import { getRecipientName, getAbsenceFromText } from '../email-helpers'

describe('getRecipientName', () => {
  it('returns "employer" for work purpose', () => {
    expect(getRecipientName('work')).toBe('employer')
  })

  it('returns "school" for school purpose', () => {
    expect(getRecipientName('school')).toBe('school')
  })

  it('returns "employer or school" for both purpose', () => {
    expect(getRecipientName('both')).toBe('employer or school')
  })

  it('returns "employer or school" for other purpose (fallback)', () => {
    expect(getRecipientName('other')).toBe('employer or school')
  })

  it('returns "employer or school" for unknown purpose (fallback)', () => {
    expect(getRecipientName('unknown')).toBe('employer or school')
  })
})

describe('getAbsenceFromText', () => {
  it('returns "from work" for work purpose', () => {
    expect(getAbsenceFromText('work')).toBe('from work')
  })

  it('returns "from school" for school purpose', () => {
    expect(getAbsenceFromText('school')).toBe('from school')
  })

  it('returns "from work and school" for both purpose', () => {
    expect(getAbsenceFromText('both')).toBe('from work and school')
  })

  it('returns empty string for other purpose (generic case)', () => {
    expect(getAbsenceFromText('other')).toBe('')
  })

  it('returns empty string for unknown purpose (generic case)', () => {
    expect(getAbsenceFromText('unknown')).toBe('')
  })
})

describe('Email helpers integration scenarios', () => {
  describe('Scenario 1: Caregiver + Work', () => {
    it('returns correct text for adult taking care of family', () => {
      const notePurpose = 'work'
      expect(getRecipientName(notePurpose)).toBe('employer')
      expect(getAbsenceFromText(notePurpose)).toBe('from work')
    })
  })

  describe('Scenario 2: Caregiver + School', () => {
    it('returns correct text for student taking care of family', () => {
      const notePurpose = 'school'
      expect(getRecipientName(notePurpose)).toBe('school')
      expect(getAbsenceFromText(notePurpose)).toBe('from school')
    })
  })

  describe("Scenario 3: Doctor's Appointment + Work", () => {
    it('returns correct text for patient with work appointment', () => {
      const notePurpose = 'work'
      expect(getRecipientName(notePurpose)).toBe('employer')
      expect(getAbsenceFromText(notePurpose)).toBe('from work')
    })
  })

  describe("Scenario 4: Doctor's Appointment + School", () => {
    it('returns correct text for patient with school appointment', () => {
      const notePurpose = 'school'
      expect(getRecipientName(notePurpose)).toBe('school')
      expect(getAbsenceFromText(notePurpose)).toBe('from school')
    })
  })
})
