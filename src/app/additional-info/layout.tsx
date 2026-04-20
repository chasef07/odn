import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Additional Information',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdditionalInfoLayout({ children }: { children: React.ReactNode }) {
  return children
}
