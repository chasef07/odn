'use client'

import { ReactNode } from 'react'
import { ShieldCheck, DollarSign } from 'lucide-react'
import { FormProgress } from './form-progress'
import { getFirstName } from '@/lib/form-storage'
import { useI18n } from '@/components/i18n/I18nProvider'
import { LanguageSwitch } from '@/components/i18n/LanguageSwitch'
import { translateReactTree } from '@/lib/i18n'

interface FormLayoutProps {
  route?: string
  title: string
  description: string
  children: ReactNode
  usePersonalization?: boolean
}

export function FormLayout({
  route,
  title,
  description,
  children,
  usePersonalization = false,
}: FormLayoutProps) {
  const firstName = usePersonalization ? getFirstName() : null
  const { t, locale } = useI18n()

  const personalizedTitle = firstName
    ? title.replace('{firstName}', firstName)
    : title.replace('{firstName}', '')

  return (
    <div className="text-foreground min-h-screen bg-white">
      <main className="mx-auto w-full max-w-4xl px-6 py-6 md:py-8">
        <div className="mb-3 flex justify-end">
          <LanguageSwitch />
        </div>
        {route && (
          <div className="mb-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <FormProgress route={route} />
            </div>

            <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs sm:gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-primary h-4 w-4" />
                <span>{t('HIPAA Compliant')}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="text-primary h-4 w-4" />
                <span>{t('Money back guarantee')}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-3 text-center">
          <h1 className="font-display text-foreground mb-3 text-3xl font-bold sm:text-4xl md:text-5xl">
            {t(personalizedTitle)}
          </h1>
          {description && (
            <p className="text-muted-foreground mx-auto max-w-2xl text-base sm:text-lg">
              {t(description)}
            </p>
          )}
        </div>

        {translateReactTree(children, locale)}
      </main>
    </div>
  )
}
