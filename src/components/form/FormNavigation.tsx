'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useI18n } from '@/components/i18n/I18nProvider'

interface FormNavigationProps {
  backRoute: string

  submitText?: string

  isSubmitting?: boolean

  canSubmit?: boolean

  onBackClick?: () => void
}

export function FormNavigation({
  backRoute,
  submitText = 'Continue',
  isSubmitting = false,
  canSubmit = true,
  onBackClick,
}: FormNavigationProps) {
  const router = useRouter()
  const { t, path } = useI18n()

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick()
    } else {
      router.push(path(backRoute))
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={handleBackClick}
        className="text-foreground hover:bg-accent inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-all"
        aria-label={t('Back')}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <button
        type="submit"
        disabled={isSubmitting || !canSubmit}
        className="bg-primary hover:bg-primary/90 inline-flex flex-1 items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
      >
        {isSubmitting ? t('Loading...') : t(submitText)}
      </button>
    </div>
  )
}
