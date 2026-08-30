import type { Metadata } from 'next'
import { Manrope, DM_Sans } from 'next/font/google'
import Script from 'next/script'
import { headers } from 'next/headers'
import './globals.css'
import '@/lib/env' // Validate environment variables on startup
import OfferCodeCapture from '@/components/OfferCodeCapture'
import { I18nProvider } from '@/components/i18n/I18nProvider'
import { englishAlternates, translate, type Locale } from '@/lib/i18n'
import { getVerificationBaseUrl, isVerificationHostname } from '@/lib/verification-url'

const sans = Manrope({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const onlineDoctorSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onlinedoctornote.com'

function requestHostname(headerList: Headers): string | null {
  return headerList.get('x-forwarded-host') || headerList.get('host')
}

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers()

  if (isVerificationHostname(requestHostname(headerList))) {
    return {
      metadataBase: new URL(getVerificationBaseUrl()),
      title: 'Document Verification | Platinum Health Clinic',
      description: 'Verify a Platinum Health Clinic medical note by Medical Record #.',
      authors: [{ name: 'Platinum Health Clinic' }],
      creator: 'Platinum Health Clinic',
      publisher: 'Platinum Health Clinic',
      formatDetection: {
        email: false,
        address: false,
        telephone: false,
      },
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  return {
    metadataBase: new URL(onlineDoctorSiteUrl),
    title: "Get a Doctor's Note in Minutes | OnlineDoctorNote",
    description:
      "Get a doctor's note online in minutes, not days. Board-certified physicians, 100% online, HIPAA compliant. For work or school absences. Only $24.95 with money-back guarantee.",
    keywords: [
      "online doctor's note",
      "doctor's note online",
      'get doctor note fast',
      'medical excuse note',
      'work absence note',
      'school absence note',
      'telemedicine doctor note',
      "official doctor's note",
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
      url: onlineDoctorSiteUrl,
      siteName: 'OnlineDoctorNote',
      title: "Get a Doctor's Note in Minutes | OnlineDoctorNote",
      description:
        "Get an official doctor's note online in minutes. Board-certified physicians, 100% online, HIPAA compliant. Only $24.95.",
      images: [
        {
          url: '/images/og-image.png',
          width: 1200,
          height: 630,
          alt: "OnlineDoctorNote - Get Your Doctor's Note Online",
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
    category: 'healthcare',
    alternates: englishAlternates('/'),
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const requestHeaders = await headers()
  const locale: Locale = requestHeaders.get('x-site-locale') === 'es' ? 'es' : 'en'
  const verificationHost = isVerificationHostname(requestHostname(requestHeaders))
  const localizedSiteUrl = locale === 'es' ? `${onlineDoctorSiteUrl}/es` : onlineDoctorSiteUrl

  return (
    <html lang={locale === 'es' ? 'es-US' : 'en-US'}>
      <head>
        {!verificationHost && (
          <>
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

            {/* Structured Data - MedicalBusiness */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'MedicalBusiness',
                  '@id': localizedSiteUrl,
                  name: 'OnlineDoctorNote',
                  url: localizedSiteUrl,
                  inLanguage: locale === 'es' ? 'es-US' : 'en-US',
                  description: translate(
                    locale,
                    "Professional online doctor's notes for work and school absences, signed by board-certified physicians."
                  ),
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
                    serviceUrl: localizedSiteUrl,
                    serviceType: translate(locale, 'Online Medical Documentation'),
                  },
                }),
              }}
            />
          </>
        )}
      </head>
      <body className={`${sans.variable} ${dmSans.variable} antialiased`}>
        {!verificationHost && (
          <>
            {/* Google Tag Manager (noscript) */}
            <noscript>
              <iframe
                src="https://www.googletagmanager.com/ns.html?id=GTM-PJPQQ5V4"
                height="0"
                width="0"
                style={{ display: 'none', visibility: 'hidden' }}
              ></iframe>
            </noscript>
            {/* End Google Tag Manager (noscript) */}
          </>
        )}
        <I18nProvider>
          {!verificationHost && <OfferCodeCapture />}
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
