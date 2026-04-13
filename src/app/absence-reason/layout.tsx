import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Absence Reason',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AbsenceReasonLayout({ children }: { children: React.ReactNode }) {
  return children
}
