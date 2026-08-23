import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Approved',
  alternates: englishAlternates('/approved'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function ApprovedLayout({ children }: { children: React.ReactNode }) {
  return children
}
