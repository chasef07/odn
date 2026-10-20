import { describe, expect, it } from 'vitest'
import { formatSeriesValue } from '@/lib/agent/chart-format'

describe('formatSeriesValue', () => {
  it('shows dollars with cents in tooltips and whole dollars on the axis', () => {
    expect(formatSeriesValue('dollars', 1234.5, 'exact')).toBe('$1,234.50')
    expect(formatSeriesValue('dollars', 1234.5, 'axis')).toBe('$1,235')
  })

  it('appends a percent sign to a 0 to 100 rate', () => {
    expect(formatSeriesValue('percent', 12.271, 'exact')).toBe('12.27%')
    expect(formatSeriesValue('percent', 12.271, 'axis')).toBe('12%')
  })

  it('groups thousands in plain numbers', () => {
    expect(formatSeriesValue('number', 3000, 'exact')).toBe('3,000')
    expect(formatSeriesValue('number', 0.125, 'exact')).toBe('0.13')
  })
})
