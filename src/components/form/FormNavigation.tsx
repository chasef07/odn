'use client'

import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/components/i18n/I18nProvider'

interface FormNavigationProps {
  submitText?: string

  isSubmitting?: boolean
}

export function FormNavigation({
  submitText = 'Continue',
  isSubmitting = false,
}: FormNavigationProps) {
  const { t } = useI18n()

  return (
    <div className="border-border/60 fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md max-md:m-0! md:static md:border-0 md:bg-transparent md:pb-0 md:backdrop-blur-none">
      <div className="mx-auto max-w-xl px-5 py-3 md:px-0 md:pt-2 md:pb-0">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary hover:bg-primary/90 inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[17px] font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t('Loading...') : t(submitText)}
          {!isSubmitting && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
