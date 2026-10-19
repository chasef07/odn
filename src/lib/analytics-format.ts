import { dateOnlyFromUtcDate, formatDateOnly } from '@/lib/dates'

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatCurrency(cents: number, showCents = false): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(cents / 100)
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  return formatDateOnly(dateOnlyFromUtcDate(new Date(iso)), 'medium')
}
