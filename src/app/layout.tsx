import type { Metadata } from 'next'
import { Manrope, DM_Sans } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import '@/lib/env' // Validate environment variables on startup

const sans = Manrope({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onlinedoctornote.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Get a Doctor\'s Note in Minutes | OnlineDoctorNote',
  description: 'Get a doctor\'s note online in minutes, not days. Board-certified physicians, 100% online, HIPAA compliant. For work or school absences. Only $24.95 with money-back guarantee.',
  keywords: [
    'online doctor\'s note',
    'doctor\'s note online',
    'get doctor note fast',
    'medical excuse note',
    'work absence note',
    'school absence note',
    'telemedicine doctor note',
    'official doctor\'s note',
    'board certified physician note',
    'HIPAA compliant medical note',
    'online medical excuse',
    'doctor note same day',
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
    title: 'Get a Doctor\'s Note in Minutes | OnlineDoctorNote',
    description: 'Get an official doctor\'s note online in minutes. Board-certified physicians, 100% online, HIPAA compliant. Only $24.95.',
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
        {/* Google Tag Manager */}
        <Script id="gtm" strategy="afterInteractive">
            {`
              (function (w, d, s, l, i) {
                w[l] = w[l] || [];
                w[l].push({
                  'gtm.start': new Date().getTime(),
                  event: 'gtm.js'
                });
                var f = d.getElementsByTagName(s)[0],
                  j = d.createElement(s),
                  dl = l !== 'dataLayer' ? '&l=' + l : '';
                j.async = true;
                j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
                f.parentNode.insertBefore(j, f);
              })(window, document, 'script', 'dataLayer', 'GTM-PJPQQ5V4');
            `}
          </Script>
        {/* End Google Tag Manager */}

        {/* Reddit Pixel */}
        <Script id="reddit-pixel" strategy="afterInteractive">
          {`
            !function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js?pixel_id=a2_ildu672qliq5";t.async=true;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
            rdt('init','a2_ildu672qliq5');
            rdt('track', 'PageVisit');
          `}
        </Script>
        {/* End Reddit Pixel */}

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
      <body className={`${sans.variable} ${dmSans.variable} antialiased`}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PJPQQ5V4"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          ></iframe>
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {children}
        <Analytics />
      </body>
    </html>
  )
}
