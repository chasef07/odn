import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Absence Reason',
  alternates: englishAlternates('/absence-reason'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function AbsenceReasonLayout({ children }: { children: React.ReactNode }) {
  return children
}
