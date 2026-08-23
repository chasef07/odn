import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  alternates: englishAlternates('/start'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return children
}
