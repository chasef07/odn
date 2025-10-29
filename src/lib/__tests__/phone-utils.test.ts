import { describe, it, expect } from 'vitest'
import { formatPhoneNumber } from '../phone-utils'

describe('formatPhoneNumber', () => {
  describe('Empty and short inputs', () => {
    it('should return empty string for empty input', () => {
      expect(formatPhoneNumber('')).toBe('')
    })

    it('should return single digit as-is', () => {
      expect(formatPhoneNumber('5')).toBe('5')
    })

    it('should return two digits as-is', () => {
      expect(formatPhoneNumber('55')).toBe('55')
    })

    it('should return three digits as-is', () => {
      expect(formatPhoneNumber('555')).toBe('555')
    })
  })

  describe('Partial formatting (4-6 digits)', () => {
    it('should format 4 digits with area code', () => {
      expect(formatPhoneNumber('5551')).toBe('(555) 1')
    })

    it('should format 5 digits with area code', () => {
      expect(formatPhoneNumber('55512')).toBe('(555) 12')
    })

    it('should format 6 digits with area code', () => {
      expect(formatPhoneNumber('555123')).toBe('(555) 123')
    })
  })

  describe('Full formatting (7-10 digits)', () => {
    it('should format 7 digits with area code and dash', () => {
      expect(formatPhoneNumber('5551234')).toBe('(555) 123-4')
    })

    it('should format 8 digits with area code and dash', () => {
      expect(formatPhoneNumber('55512345')).toBe('(555) 123-45')
    })

    it('should format 9 digits with area code and dash', () => {
      expect(formatPhoneNumber('555123456')).toBe('(555) 123-456')
    })

    it('should format 10 digits into full (XXX) XXX-XXXX format', () => {
      expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567')
    })

    it('should format common US number correctly', () => {
      expect(formatPhoneNumber('2025551234')).toBe('(202) 555-1234')
    })
  })

  describe('Non-numeric character removal', () => {
    it('should remove dashes from input', () => {
      expect(formatPhoneNumber('555-123-4567')).toBe('(555) 123-4567')
    })

    it('should remove spaces from input', () => {
      expect(formatPhoneNumber('555 123 4567')).toBe('(555) 123-4567')
    })

    it('should remove parentheses from input', () => {
      expect(formatPhoneNumber('(555) 123-4567')).toBe('(555) 123-4567')
    })

    it('should remove dots from input', () => {
      expect(formatPhoneNumber('555.123.4567')).toBe('(555) 123-4567')
    })

    it('should remove mixed non-numeric characters', () => {
      expect(formatPhoneNumber('(555) 123-4567 ext. 890')).toBe('(555) 123-4567')
    })

    it('should remove letters from input', () => {
      expect(formatPhoneNumber('555CALL567')).toBe('(555) 567')
    })

    it('should handle input with only non-numeric characters', () => {
      expect(formatPhoneNumber('abc-def')).toBe('')
    })

    it('should remove special characters', () => {
      expect(formatPhoneNumber('555@123#4567')).toBe('(555) 123-4567')
    })
  })

  describe('More than 10 digits', () => {
    it('should truncate to 10 digits', () => {
      expect(formatPhoneNumber('55512345678')).toBe('(555) 123-4567')
    })

    it('should truncate to 10 digits with country code', () => {
      expect(formatPhoneNumber('15551234567')).toBe('(155) 512-3456')
    })

    it('should truncate very long inputs', () => {
      expect(formatPhoneNumber('555123456789012345')).toBe('(555) 123-4567')
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle pasted phone number with formatting', () => {
      expect(formatPhoneNumber('(415) 555-0123')).toBe('(415) 555-0123')
    })

    it('should handle international format stripped to 10 digits', () => {
      expect(formatPhoneNumber('+1 555 123 4567')).toBe('(155) 512-3456')
    })

    it('should handle phone number with extension removed', () => {
      const input = '555-123-4567 x890'
      expect(formatPhoneNumber(input)).toBe('(555) 123-4567')
    })

    it('should handle progressive typing simulation', () => {
      // Simulates user typing one digit at a time
      expect(formatPhoneNumber('5')).toBe('5')
      expect(formatPhoneNumber('55')).toBe('55')
      expect(formatPhoneNumber('555')).toBe('555')
      expect(formatPhoneNumber('5551')).toBe('(555) 1')
      expect(formatPhoneNumber('55512')).toBe('(555) 12')
      expect(formatPhoneNumber('555123')).toBe('(555) 123')
      expect(formatPhoneNumber('5551234')).toBe('(555) 123-4')
      expect(formatPhoneNumber('55512345')).toBe('(555) 123-45')
      expect(formatPhoneNumber('555123456')).toBe('(555) 123-456')
      expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567')
    })
  })

  describe('Edge cases', () => {
    it('should handle all zeros', () => {
      expect(formatPhoneNumber('0000000000')).toBe('(000) 000-0000')
    })

    it('should handle all nines', () => {
      expect(formatPhoneNumber('9999999999')).toBe('(999) 999-9999')
    })

    it('should handle repeated digits', () => {
      expect(formatPhoneNumber('1111111111')).toBe('(111) 111-1111')
    })

    it('should handle whitespace only', () => {
      expect(formatPhoneNumber('   ')).toBe('')
    })

    it('should handle tabs and newlines', () => {
      expect(formatPhoneNumber('555\t123\n4567')).toBe('(555) 123-4567')
    })

    it('should be idempotent (formatting formatted number)', () => {
      const formatted = formatPhoneNumber('5551234567')
      expect(formatPhoneNumber(formatted)).toBe(formatted)
    })
  })

  describe('Boundary values', () => {
    it('should handle transition from 3 to 4 digits', () => {
      expect(formatPhoneNumber('555')).toBe('555')
      expect(formatPhoneNumber('5551')).toBe('(555) 1')
    })

    it('should handle transition from 6 to 7 digits', () => {
      expect(formatPhoneNumber('555123')).toBe('(555) 123')
      expect(formatPhoneNumber('5551234')).toBe('(555) 123-4')
    })

    it('should handle transition from 9 to 10 digits', () => {
      expect(formatPhoneNumber('555123456')).toBe('(555) 123-456')
      expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567')
    })

    it('should handle transition from 10 to 11 digits', () => {
      expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567')
      expect(formatPhoneNumber('55512345678')).toBe('(555) 123-4567')
    })
  })
})
