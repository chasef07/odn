import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Who Is Using This Note',
  alternates: englishAlternates('/who-is-using'),
  robots: { index: false, follow: false },
}

export default function WhoIsUsingLayout({ children }: { children: React.ReactNode }) {
  return children
}
