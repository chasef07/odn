import { describe, it, expect } from 'vitest'
import { getBackRoute, getNextRoute, getStepNumber } from '@/lib/form-steps'

describe('form-steps registry', () => {
  describe('getStepNumber', () => {
    it('numbers steps for the someone_else flow (includes guardian-info)', () => {
      expect(getStepNumber('/contact-info', 'someone_else')).toBe(5)
      expect(getStepNumber('/note-purpose', 'someone_else')).toBe(6)
      expect(getStepNumber('/absence-dates', 'someone_else')).toBe(7)
      expect(getStepNumber('/absence-reason', 'someone_else')).toBe(8)
      expect(getStepNumber('/symptoms', 'someone_else')).toBe(9)
      expect(getStepNumber('/additional-info', 'someone_else')).toBe(10)
      expect(getStepNumber('/review', 'someone_else')).toBe(11)
    })

    it('shifts steps down by one for the myself flow (skips guardian-info)', () => {
      expect(getStepNumber('/contact-info', 'myself')).toBe(4)
      expect(getStepNumber('/note-purpose', 'myself')).toBe(5)
      expect(getStepNumber('/absence-dates', 'myself')).toBe(6)
      expect(getStepNumber('/absence-reason', 'myself')).toBe(7)
      expect(getStepNumber('/symptoms', 'myself')).toBe(8)
      expect(getStepNumber('/additional-info', 'myself')).toBe(9)
      expect(getStepNumber('/review', 'myself')).toBe(10)
    })

    it('throws for an unknown route', () => {
      expect(() => getStepNumber('/nope', 'myself')).toThrow('Unknown form step route: /nope')
    })
  })

  describe('getBackRoute', () => {
    it('routes contact-info back based on recipient', () => {
      expect(getBackRoute('/contact-info', 'someone_else')).toBe('/guardian-info')
      expect(getBackRoute('/contact-info', 'myself')).toBe('/basic-info')
    })

    it('returns the previous step for later pages', () => {
      expect(getBackRoute('/note-purpose', 'myself')).toBe('/contact-info')
      expect(getBackRoute('/additional-info', 'myself')).toBe('/symptoms')
      expect(getBackRoute('/symptoms', 'myself')).toBe('/absence-reason')
      expect(getBackRoute('/review', 'myself')).toBe('/additional-info')
    })

    it('returns null for the first step', () => {
      expect(getBackRoute('/get-started', 'myself')).toBeNull()
    })
  })

  describe('getNextRoute', () => {
    it('returns the following step', () => {
      expect(getNextRoute('/contact-info', 'myself')).toBe('/note-purpose')
      expect(getNextRoute('/absence-reason', 'myself')).toBe('/symptoms')
      expect(getNextRoute('/symptoms', 'myself')).toBe('/additional-info')
      expect(getNextRoute('/additional-info', 'myself')).toBe('/review')
    })

    it('returns null for the last step', () => {
      expect(getNextRoute('/review', 'myself')).toBeNull()
    })
  })
})
