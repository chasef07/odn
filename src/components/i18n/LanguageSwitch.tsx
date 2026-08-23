'use client'

import Link from 'next/link'
import { Languages } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { switchLocalePath } from '@/lib/i18n'
import { useI18n } from './I18nProvider'

type LanguageSwitchProps = {
  compact?: boolean
  className?: string
  onNavigate?: () => void
}

export function LanguageSwitch({ compact = false, className = '', onNavigate }: LanguageSwitchProps) {
  const pathname = usePathname()
  const { locale } = useI18n()
  const targetLocale = locale === 'es' ? 'en' : 'es'
  const label = locale === 'es' ? 'English' : 'Español'
  const href = switchLocalePath(pathname, targetLocale)

  return (
    <Link
      href={href}
      hrefLang={targetLocale === 'es' ? 'es-US' : 'en-US'}
      lang={targetLocale}
      onClick={(event) => {
        onNavigate?.()
        if (typeof window !== 'undefined' && (window.location.search || window.location.hash)) {
          event.preventDefault()
          window.location.assign(`${href}${window.location.search}${window.location.hash}`)
        }
      }}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:border-[#009ed9]/40 hover:text-[#007fac] focus-visible:ring-2 focus-visible:ring-[#009ed9] focus-visible:ring-offset-2 focus-visible:outline-none ${className}`}
      aria-label={locale === 'es' ? 'Cambiar el sitio a inglés' : 'Switch site to Spanish'}
    >
      {!compact && <Languages className="h-4 w-4" aria-hidden="true" />}
      {label}
    </Link>
  )
}
