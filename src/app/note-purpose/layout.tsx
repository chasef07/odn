import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Note Purpose',
  robots: {
    index: false,
    follow: false,
  },
}

export default function NotePurposeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
