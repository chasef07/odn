import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Guardian Information',
  alternates: englishAlternates('/guardian-info'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function GuardianInfoLayout({ children }: { children: React.ReactNode }) {
  return children
}
