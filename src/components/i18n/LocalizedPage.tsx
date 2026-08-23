'use client'

import type { ReactNode } from 'react'
import { translateReactTree } from '@/lib/i18n'
import { useI18n } from './I18nProvider'

export function LocalizedPage({ children }: { children: ReactNode }) {
  const { locale } = useI18n()
  return translateReactTree(children, locale)
}
