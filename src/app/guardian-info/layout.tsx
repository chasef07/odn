import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Guardian Information',
  robots: {
    index: false,
    follow: false,
  },
}

export default function GuardianInfoLayout({ children }: { children: React.ReactNode }) {
  return children
}
