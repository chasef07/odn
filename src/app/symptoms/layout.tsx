import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Symptoms',
  alternates: englishAlternates('/symptoms'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function SymptomsLayout({ children }: { children: React.ReactNode }) {
  return children
}
