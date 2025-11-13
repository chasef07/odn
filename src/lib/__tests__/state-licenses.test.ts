/**
 * Tests for State Medical License Mappings
 * Ensures business-critical license data is correct and complete
 */

import { describe, it, expect } from 'vitest'
import { STATE_LICENSES, getStateLicense } from '../state-licenses'
import { AVAILABLE_STATES } from '../form-constants'

describe('STATE_LICENSES', () => {
  describe('Data Integrity', () => {
    it('should have exactly 44 state mappings', () => {
      const stateCount = Object.keys(STATE_LICENSES).length
      expect(stateCount).toBe(44)
    })

    it('should have license numbers for all AVAILABLE_STATES', () => {
      const missingStates: string[] = []

      AVAILABLE_STATES.forEach((state) => {
        if (!STATE_LICENSES[state]) {
          missingStates.push(state)
        }
      })

      expect(missingStates).toEqual([])
    })

    it('should not have any extra states beyond AVAILABLE_STATES', () => {
      const extraStates: string[] = []

      Object.keys(STATE_LICENSES).forEach((state) => {
        if (!AVAILABLE_STATES.includes(state)) {
          extraStates.push(state)
        }
      })

      expect(extraStates).toEqual([])
    })

    it('should have non-empty license numbers for all states', () => {
      const statesWithEmptyLicenses: string[] = []

      Object.entries(STATE_LICENSES).forEach(([state, license]) => {
        if (!license || license.trim() === '') {
          statesWithEmptyLicenses.push(state)
        }
      })

      expect(statesWithEmptyLicenses).toEqual([])
    })

    it('should have valid license number formats (no placeholder text)', () => {
      const invalidLicenses: string[] = []
      const invalidPatterns = ['xxx', 'test', 'placeholder', 'todo', 'fix']

      Object.entries(STATE_LICENSES).forEach(([state, license]) => {
        const lowerLicense = license.toLowerCase()
        if (invalidPatterns.some((pattern) => lowerLicense.includes(pattern))) {
          invalidLicenses.push(`${state}: ${license}`)
        }
      })

      expect(invalidLicenses).toEqual([])
    })
  })

  describe('Specific State Licenses', () => {
    it('should have correct Texas license number', () => {
      expect(STATE_LICENSES['Texas']).toBe('V6158')
    })

    it('should have correct California license number', () => {
      expect(STATE_LICENSES['California']).toBe('A97833')
    })

    it('should have correct New York license number', () => {
      expect(STATE_LICENSES['New York']).toBe('229551')
    })

    it('should have correct Florida license number', () => {
      expect(STATE_LICENSES['Florida']).toBe('ME90639')
    })
  })
})

describe('getStateLicense', () => {
  describe('Valid States', () => {
    it('should return correct format for Texas', () => {
      const result = getStateLicense('Texas')

      expect(result).not.toBeNull()
      expect(result).toEqual({
        stateName: 'Texas',
        licenseNumber: 'V6158',
      })
    })

    it('should return correct format for California', () => {
      const result = getStateLicense('California')

      expect(result).not.toBeNull()
      expect(result).toEqual({
        stateName: 'California',
        licenseNumber: 'A97833',
      })
    })

    it('should return correct format for New York', () => {
      const result = getStateLicense('New York')

      expect(result).not.toBeNull()
      expect(result).toEqual({
        stateName: 'New York',
        licenseNumber: '229551',
      })
    })

    it('should return correct format for states with spaces in name', () => {
      const result = getStateLicense('New Hampshire')

      expect(result).not.toBeNull()
      expect(result?.stateName).toBe('New Hampshire')
      expect(result?.licenseNumber).toBe('34364')
    })

    it('should return valid data for all AVAILABLE_STATES', () => {
      AVAILABLE_STATES.forEach((state) => {
        const result = getStateLicense(state)

        expect(result).not.toBeNull()
        expect(result?.stateName).toBe(state)
        expect(result?.licenseNumber).toBeTruthy()
        expect(typeof result?.licenseNumber).toBe('string')
      })
    })
  })

  describe('Invalid States', () => {
    it('should return null for non-existent state', () => {
      const result = getStateLicense('Fake State')
      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = getStateLicense('')
      expect(result).toBeNull()
    })

    it('should return null for states not in AVAILABLE_STATES', () => {
      // States not in the 44 available states
      const unavailableStates = [
        'Alaska',
        'Arkansas',
        'Massachusetts',
        'North Carolina',
        'Oregon',
        'Rhode Island',
        'South Carolina',
      ]

      unavailableStates.forEach((state) => {
        const result = getStateLicense(state)
        expect(result).toBeNull()
      })
    })

    it('should be case-sensitive', () => {
      const result = getStateLicense('texas') // lowercase
      expect(result).toBeNull()
    })

    it('should not trim whitespace automatically', () => {
      const result = getStateLicense(' Texas ')
      expect(result).toBeNull()
    })
  })

  describe('Return Value Structure', () => {
    it('should return object with correct keys', () => {
      const result = getStateLicense('Texas')

      expect(result).not.toBeNull()
      expect(Object.keys(result!)).toEqual(['stateName', 'licenseNumber'])
    })

    it('should return stateName matching input exactly', () => {
      const testStates = ['Texas', 'New York', 'West Virginia']

      testStates.forEach((state) => {
        const result = getStateLicense(state)
        expect(result?.stateName).toBe(state)
      })
    })

    it('should return non-empty licenseNumber strings', () => {
      AVAILABLE_STATES.forEach((state) => {
        const result = getStateLicense(state)

        expect(result?.licenseNumber).toBeTruthy()
        expect(typeof result?.licenseNumber).toBe('string')
        expect(result!.licenseNumber.length).toBeGreaterThan(0)
      })
    })
  })
})
