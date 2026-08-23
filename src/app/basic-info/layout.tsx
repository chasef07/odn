import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Basic Information',
  alternates: englishAlternates('/basic-info'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function BasicInfoLayout({ children }: { children: React.ReactNode }) {
  return children
}
