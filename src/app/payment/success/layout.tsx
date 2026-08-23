import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Payment Successful',
  alternates: englishAlternates('/payment/success'),
  robots: { index: false, follow: false },
}

export default function PaymentSuccessLayout({ children }: { children: React.ReactNode }) {
  return children
}
