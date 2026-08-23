import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Absence Dates',
  alternates: englishAlternates('/absence-dates'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function AbsenceDatesLayout({ children }: { children: React.ReactNode }) {
  return children
}
