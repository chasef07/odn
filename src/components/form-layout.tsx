'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ShieldCheck, BadgeCheck } from 'lucide-react'
import { FormProgress } from './form-progress'
import type { IntakeRoute } from '@/lib/intake'
import { getFirstName } from '@/lib/form-storage'
import { useI18n } from '@/components/i18n/I18nProvider'
import { LanguageMenu } from '@/components/i18n/LanguageMenu'
import { translateReactTree } from '@/lib/i18n'

interface FormLayoutProps {
  route?: IntakeRoute
  backHref?: string
  title: string
  description: string
  children: ReactNode
  usePersonalization?: boolean
}

export function FormLayout({
  route,
  backHref,
  title,
  description,
  children,
  usePersonalization = false,
}: FormLayoutProps) {
  const router = useRouter()
  const firstName = usePersonalization ? getFirstName() : null
  const { t, locale, path } = useI18n()

  const personalizedTitle = firstName
    ? title.replace('{firstName}', firstName)
    : title.replace('{firstName}', '')

  return (
    <div className="text-foreground min-h-dvh bg-white">
      <header className="border-border/60 sticky top-0 z-40 border-b bg-white/90 backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-xl grid-cols-[44px_1fr_auto] items-center gap-2 px-3 sm:px-5">
          {backHref ? (
            <button
              type="button"
              onClick={() => router.push(path(backHref))}
              className="text-foreground hover:bg-muted -ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors active:scale-95"
              aria-label={t('Back')}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span />
          )}
          <p className="font-display justify-self-center text-base font-bold tracking-tight">
            <span className="text-primary">Online</span>
            <span className="text-foreground">DoctorNote</span>
          </p>
          <LanguageMenu />
        </div>
        {route && <FormProgress route={route} />}
      </header>

      <main className="mx-auto w-full max-w-xl animate-[fadeIn_250ms_ease-out] px-5 pt-7 pb-36 motion-reduce:animate-none md:pb-16">
        <h1 className="font-display text-foreground text-[26px] leading-[1.15] font-bold tracking-tight sm:text-3xl">
          {t(personalizedTitle)}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">{t(description)}</p>
        )}

        <div className="mt-7">{translateReactTree(children, locale)}</div>

        {route && (
          <div className="text-muted-foreground mt-8 flex items-center justify-center gap-5 text-xs">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="text-primary h-4 w-4" />
              {t('HIPAA Compliant')}
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeCheck className="text-primary h-4 w-4" />
              {t('Money back guarantee')}
            </span>
          </div>
        )}
      </main>
    </div>
  )
}
