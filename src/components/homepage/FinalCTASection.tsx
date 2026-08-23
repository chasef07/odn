'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/components/i18n/I18nProvider'

export default function FinalCTASection() {
  const router = useRouter()
  const { t, path } = useI18n()

  return (
    <section className="bg-gray-900 px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="mb-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {t("Get Your Doctor's Note")}
          <br className="sm:hidden" /> {t('From the Comfort of Your Home')}
        </h2>
        <p className="mb-8 text-lg text-gray-400">{t('Skip the waiting room. Get started now.')}</p>
        <button
          onClick={() => router.push(path('/start'))}
          className="inline-flex items-center gap-2 rounded-full bg-[#009ed9] px-8 py-4 text-base font-medium text-white transition-all hover:bg-[#00b4f5]"
        >
          {t('Get Your Note — $24.95')}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  )
}
