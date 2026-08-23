'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { useI18n } from './I18nProvider'

export function useLocalizedRouter() {
  const router = useRouter()
  const { path } = useI18n()

  return useMemo(
    () => ({
      ...router,
      push: (href: string) => router.push(path(href)),
      replace: (href: string) => router.replace(path(href)),
      prefetch: (href: string) => router.prefetch(path(href)),
    }),
    [path, router]
  )
}
