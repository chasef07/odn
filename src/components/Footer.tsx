'use client'

import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'
import { useI18n } from '@/components/i18n/I18nProvider'
import { currentYearET } from '@/lib/dates'

export default function Footer() {
  const { t, path } = useI18n()
  return (
    <footer className="border-t border-gray-100 bg-white px-4 py-12 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex flex-col sm:flex-row sm:gap-8">
            <a
              href="mailto:hello@onlinedoctornote.com"
              className="flex min-h-11 items-center justify-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900 md:min-h-0"
            >
              <Mail className="h-4 w-4" />
              hello@onlinedoctornote.com
            </a>
            <a
              href="tel:917-300-8543"
              className="flex min-h-11 flex-wrap items-center justify-center gap-x-2 text-sm text-gray-600 transition-colors hover:text-gray-900 md:min-h-0"
            >
              <Phone className="h-4 w-4" />
              917-300-8543
              <span className="text-gray-400">{t('(8am–8pm EST)')}</span>
            </a>
          </div>

          <div className="flex flex-wrap justify-center gap-x-6 text-sm md:justify-end md:gap-6">
            <Link
              href={path('/faq')}
              className="inline-flex min-h-11 items-center text-gray-600 transition-colors hover:text-gray-900 md:min-h-0"
            >
              {t('FAQ')}
            </Link>
            <Link
              href={path('/blog')}
              className="inline-flex min-h-11 items-center text-gray-600 transition-colors hover:text-gray-900 md:min-h-0"
            >
              {t('Blog')}
            </Link>
            <Link
              href={path('/privacy-policy')}
              className="inline-flex min-h-11 items-center text-gray-600 transition-colors hover:text-gray-900 md:min-h-0"
            >
              {t('Privacy')}
            </Link>
            <Link
              href={path('/terms-of-service')}
              className="inline-flex min-h-11 items-center text-gray-600 transition-colors hover:text-gray-900 md:min-h-0"
            >
              {t('Terms')}
            </Link>
            <Link
              href={path('/about')}
              className="inline-flex min-h-11 items-center text-gray-600 transition-colors hover:text-gray-900 md:min-h-0"
            >
              {t('About')}
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 border-t border-gray-100 pt-8 text-center md:flex-row md:justify-between md:text-left">
          <p className="text-sm text-gray-500">
            © {currentYearET()} OnlineDoctorNote.com · {t('HIPAA Compliant')}
          </p>
          <p className="text-sm text-gray-400">
            {t('Powered by')}{' '}
            <a
              href="https://www.databuddiessolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 transition-colors hover:text-gray-700"
            >
              Data Buddies
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
