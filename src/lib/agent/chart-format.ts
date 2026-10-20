export const SERIES_FORMATS = ['number', 'dollars', 'percent'] as const

export type SeriesFormat = (typeof SERIES_FORMATS)[number]

export type FormatPrecision = 'exact' | 'axis'

const formatters: Record<SeriesFormat, Record<FormatPrecision, Intl.NumberFormat>> = {
  number: {
    exact: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }),
    axis: new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }),
  },
  dollars: {
    exact: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    axis: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }),
  },
  percent: {
    exact: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }),
    axis: new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }),
  },
}

export function formatSeriesValue(
  format: SeriesFormat,
  value: number,
  precision: FormatPrecision
): string {
  const text = formatters[format][precision].format(value)
  return format === 'percent' ? `${text}%` : text
}
