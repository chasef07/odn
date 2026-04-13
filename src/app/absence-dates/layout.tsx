import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Absence Dates',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AbsenceDatesLayout({ children }: { children: React.ReactNode }) {
  return children
}
