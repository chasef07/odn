'use client'

import { DollarSign, Clock, Shield, Home, Users, HeartHandshake, CircleCheck } from 'lucide-react'
import { useI18n } from '@/components/i18n/I18nProvider'

const benefits = [
  {
    icon: DollarSign,
    title: 'Save Money',
    description:
      'Just $24.95 — a fraction of an office visit or urgent care copay. No hidden fees, ever.',
  },
  {
    icon: Clock,
    title: 'Save Time',
    description: 'Get your note in minutes, not hours. No scheduling and no commute required.',
  },
  {
    icon: Shield,
    title: 'No Insurance Needed',
    description:
      'No insurance? No problem. Our simple flat rate means affordable care for everyone.',
  },
  {
    icon: Home,
    title: 'No Driving Required',
    description: 'Complete everything from your couch, your bed, or wherever you are. 100% online.',
  },
  {
    icon: Users,
    title: 'No Waiting Rooms',
    description:
      'Skip the crowded waiting room. No exposure to other sick patients while you recover.',
  },
  {
    icon: HeartHandshake,
    title: "We're Here to Help",
    description:
      'Real board-certified doctors who care. We verify your note if your employer or school calls.',
  },
]

export default function WhyUseUsSection() {
  const { t } = useI18n()
  return (
    <section className="bg-[#009ed9] px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {t('Why Thousands of Patients Trust Us')}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-white/80">
            {t("We make getting a doctor's note simple, affordable, and stress-free.")}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="flex items-start gap-4 rounded-2xl bg-white/10 p-5 transition-colors duration-300 hover:bg-white/15"
            >
              <div className="shrink-0 rounded-xl bg-white/20 p-2.5">
                <benefit.icon className="h-5 w-5 text-white" strokeWidth={1.5} />
              </div>
              <div>
                <div className="mb-0.5 flex items-center gap-1.5">
                  <CircleCheck className="h-4 w-4 text-white/70" strokeWidth={2} />
                  <h3 className="text-base font-semibold text-white">{t(benefit.title)}</h3>
                </div>
                <p className="text-sm text-white/80">{t(benefit.description)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
