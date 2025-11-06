import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import '@/lib/env' // Validate environment variables on startup

const sans = Manrope({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'OnlineDoctorNote Intake',
  description: 'Simple and secure patient intake created for OnlineDoctorNote clients.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} antialiased`}>{children}</body>
    </html>
  )
}
