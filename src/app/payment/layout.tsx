import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Payment',
  alternates: englishAlternates('/payment'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return children
}
