'use client'

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { localeFromPathname, localizePath, translate, type Locale } from '@/lib/i18n'

type I18nContextValue = {
  locale: Locale
  t: (english: string) => string
  path: (path: string) => string
}

const defaultContext: I18nContextValue = {
  locale: 'en',
  t: (english) => english,
  path: (path) => path,
}

const I18nContext = createContext<I18nContextValue>(defaultContext)

export function I18nProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const locale = localeFromPathname(pathname)
  useEffect(() => {
    document.documentElement.lang = locale === 'es' ? 'es-US' : 'en-US'
  }, [locale])
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (english) => translate(locale, english),
      path: (path) => localizePath(path, locale),
    }),
    [locale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
