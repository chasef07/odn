import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Basic Information',
  robots: {
    index: false,
    follow: false,
  },
}

export default function BasicInfoLayout({ children }: { children: React.ReactNode }) {
  return children
}
