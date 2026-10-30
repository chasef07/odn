import { describe, expect, it } from 'vitest'
import { servedStateFromSubdivision } from '@/lib/detected-state'

describe('servedStateFromSubdivision', () => {
  it('reads the CLDR subdivision the load balancer sends', () => {
    expect(servedStateFromSubdivision('USFL')).toBe('Florida')
    expect(servedStateFromSubdivision('usdc')).toBe('District of Columbia')
    expect(servedStateFromSubdivision('US-NY')).toBe('New York')
  })

  it('detects nothing for a missing, foreign or unknown subdivision', () => {
    expect(servedStateFromSubdivision(null)).toBeNull()
    expect(servedStateFromSubdivision('')).toBeNull()
    expect(servedStateFromSubdivision('CAON')).toBeNull()
    expect(servedStateFromSubdivision('USZZ')).toBeNull()
  })

  it('detects nothing in a state the service does not serve', () => {
    expect(servedStateFromSubdivision('USAK')).toBeNull()
    expect(servedStateFromSubdivision('USMA')).toBeNull()
  })
})
