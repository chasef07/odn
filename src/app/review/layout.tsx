import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Review',
  alternates: englishAlternates('/review'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
