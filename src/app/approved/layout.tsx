import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Approved',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ApprovedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
