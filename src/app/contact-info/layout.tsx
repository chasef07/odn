import type { Metadata } from 'next'
import { englishAlternates } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Contact Information',
  alternates: englishAlternates('/contact-info'),
  robots: {
    index: false,
    follow: false,
  },
}

export default function ContactInfoLayout({ children }: { children: React.ReactNode }) {
  return children
}
