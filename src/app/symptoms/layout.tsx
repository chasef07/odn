import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Symptoms',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SymptomsLayout({ children }: { children: React.ReactNode }) {
  return children
}
