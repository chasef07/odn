import type { Metadata } from 'next'

export const metadata: Metadata = {
  openGraph: { locale: 'es_US', alternateLocale: ['en_US'] },
}

export default function SpanishLayout({ children }: { children: React.ReactNode }) {
  return children
}
