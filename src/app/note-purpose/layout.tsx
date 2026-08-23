import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Note Purpose',
  alternates: englishAlternates('/note-purpose'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function NotePurposeLayout({ children }: { children: React.ReactNode }) {
  return children
}
