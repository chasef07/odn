import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Additional Information',
  alternates: englishAlternates('/additional-info'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdditionalInfoLayout({ children }: { children: React.ReactNode }) {
  return children
}
