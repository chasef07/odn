import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'
import '@/lib/env' // Validate environment variables on startup

const sans = Manrope({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onlinedoctornote.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Online Doctor\'s Note - Fast, Legal, Affordable | $24.95',
    template: '%s | OnlineDoctorNote'
  },
  description: 'Get a legitimate doctor\'s note online in hours. Board-certified physicians, 100% online, HIPAA compliant. For work or school absences. Only $24.95 with money-back guarantee.',
  keywords: [
    'online doctor\'s note',
    'doctor\'s note online',
    'medical excuse note',
    'work absence note',
    'school absence note',
    'telemedicine doctor note',
    'legitimate doctor\'s note',
    'board certified physician note',
    'HIPAA compliant medical note',
    'online medical excuse',
  ],
  authors: [{ name: 'OnlineDoctorNote' }],
  creator: 'OnlineDoctorNote',
  publisher: 'OnlineDoctorNote',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'OnlineDoctorNote',
    title: 'Online Doctor\'s Note - Fast, Legal, Affordable | $24.95',
    description: 'Get a legitimate doctor\'s note online in hours. Board-certified physicians, 100% online, HIPAA compliant. Only $24.95.',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OnlineDoctorNote - Get Your Doctor\'s Note Online',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  category: 'healthcare',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Structured Data - MedicalBusiness */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'MedicalBusiness',
              '@id': siteUrl,
              name: 'OnlineDoctorNote',
              url: siteUrl,
              description: 'Professional online doctor\'s notes for work and school absences, signed by board-certified physicians.',
              address: {
                '@type': 'PostalAddress',
                addressCountry: 'US',
              },
              email: 'hello@onlinedoctornote.com',
              telephone: '+1-917-300-8543',
              priceRange: '$24.95',
              medicalSpecialty: 'Telemedicine',
              areaServed: {
                '@type': 'Country',
                name: 'United States',
              },
              availableChannel: {
                '@type': 'ServiceChannel',
                serviceUrl: siteUrl,
                serviceType: 'Online Medical Documentation',
              },
            }),
          }}
        />
      </head>
      <body className={`${sans.variable} antialiased`}>
        {children}
        <Analytics />

        {/* Google Ads Global Tag */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17015921669"
          strategy="afterInteractive"
        />
        <Script id="google-ads-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17015921669');
          `}
        </Script>
      </body>
    </html>
  )
}
