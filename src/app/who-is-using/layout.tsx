import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Who Is Using This Note',
  robots: { index: false, follow: false },
}

export default function WhoIsUsingLayout({ children }: { children: React.ReactNode }) {
  return children
}
