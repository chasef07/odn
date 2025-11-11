import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Information',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ContactInfoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
