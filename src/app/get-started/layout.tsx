import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Get Started',
  alternates: englishAlternates('/get-started'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function GetStartedLayout({ children }: { children: React.ReactNode }) {
  return children
}
