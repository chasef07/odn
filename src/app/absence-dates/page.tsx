'use client'

import { useState } from 'react'
import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLayout } from '@/components/form-layout'
import { FormCard } from '@/components/form/FormCard'
import { FormField } from '@/components/form/FormField'
import { FormNavigation } from '@/components/form/FormNavigation'
import { useI18n } from '@/components/i18n/I18nProvider'
import {
  addDays,
  formatDateOnly,
  inclusiveDayCount,
  parseDateOnly,
  todayInViewerZone,
  type DateOnly,
} from '@/lib/dates'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { backRoute, nextRoute } from '@/lib/intake'
import { DATE_LIMITS } from '@/lib/validation-constants'
import { absenceDatesSchema } from '@/lib/validation-schemas'

const ROUTE = '/absence-dates'

const DAY_COUNTS = Array.from({ length: DATE_LIMITS.MAX_ABSENCE_DAYS }, (_, index) => index + 1)

type FormData = {
  firstDayOff: string
  lastDayOff: string
}

type Destination = 'work' | 'school' | null

function chipRange(today: DateOnly, firstDayOff: string, lastDayOff: string) {
  const first = parseDateOnly(firstDayOff)
  const last = parseDateOnly(lastDayOff)
  if (!first || first > today || first < addDays(today, -DATE_LIMITS.MAX_DAYS_IN_PAST)) {
    return null
  }
  if (!last) return { first, dayCount: null }
  const dayCount = inclusiveDayCount(first, last)
  if (dayCount < 1 || dayCount > DATE_LIMITS.MAX_ABSENCE_DAYS) return null
  return { first, last, dayCount }
}

function chipClass(selected: boolean, shape: string): string {
  return `has-focus-visible:ring-primary/40 inline-flex h-12 cursor-pointer items-center justify-center border whitespace-nowrap text-[15px] font-semibold sm:text-base transition-all has-focus-visible:ring-2 ${shape} ${
    selected
      ? 'border-primary bg-primary text-white shadow-sm'
      : 'border-border/60 text-foreground hover:border-primary/40 bg-white'
  }`
}

export default function AbsenceDatesPage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  const today = todayInViewerZone()
  const savedData = getFormData()
  const savedFirst = savedData.firstDayOff || ''
  const savedLast = savedData.lastDayOff || ''
  const destination: Destination =
    savedData.notePurpose === 'work' || savedData.notePurpose === 'school'
      ? savedData.notePurpose
      : null

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<FormData>({
    resolver: zodResolver(absenceDatesSchema),
    defaultValues: { firstDayOff: savedFirst, lastDayOff: savedLast },
  })

  const [firstDayOff, lastDayOff] = useWatch({ control, name: ['firstDayOff', 'lastDayOff'] })
  const range = chipRange(today, firstDayOff, lastDayOff)
  const [exactDates, setExactDates] = useState(
    Boolean(savedFirst || savedLast) && !chipRange(today, savedFirst, savedLast)?.dayCount
  )
  const [showEarlier, setShowEarlier] = useState(Boolean(range && range.first < addDays(today, -1)))

  const setDates = (first: string, last: string) => {
    setValue('firstDayOff', first, { shouldValidate: isSubmitted })
    setValue('lastDayOff', last, { shouldValidate: isSubmitted })
  }

  const pickFirstDay = (first: DateOnly) => {
    setDates(first, range?.dayCount ? addDays(first, range.dayCount - 1) : '')
  }

  const pickDayCount = (dayCount: number) => {
    if (range) setDates(range.first, addDays(range.first, dayCount - 1))
  }

  const usePresets = () => {
    if (!range?.dayCount) setDates('', '')
    setExactDates(false)
  }

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push(nextRoute(ROUTE, getFormData()))
  }

  const firstDayChoices: { day: DateOnly; label: string }[] = [
    { day: today, label: t('Today') },
    { day: addDays(today, -1), label: t('Yesterday') },
    ...(showEarlier
      ? Array.from({ length: DATE_LIMITS.MAX_DAYS_IN_PAST - 1 }, (_, index) => {
          const day = addDays(today, -(index + 2))
          return { day, label: formatDateOnly(day, 'weekdayShort', locale) }
        })
      : []),
  ]

  const title =
    destination === 'work'
      ? 'Which days do you need off work?'
      : destination === 'school'
        ? 'Which days do you need off school?'
        : 'Which days do you need covered?'

  return (
    <FormLayout route={ROUTE} title={title} description="" usePersonalization={true}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormCard spacing="space-y-6">
          <p className="bg-primary/5 border-primary/15 text-foreground rounded-xl border px-4 py-3 text-center text-sm">
            {t('Your note can cover up to 7 days in a row, starting as far back as 7 days ago.')}
          </p>

          {exactDates ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="firstDayOff"
                label="First Day Off"
                type="date"
                register={register('firstDayOff')}
                error={errors.firstDayOff}
              />
              <FormField
                id="lastDayOff"
                label="Last Day Off"
                type="date"
                register={register('lastDayOff')}
                error={errors.lastDayOff}
              />
            </div>
          ) : (
            <>
              <fieldset className="space-y-3">
                <legend className="text-foreground mb-3 text-sm font-semibold">
                  {t('First Day Off')}
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {firstDayChoices.map(({ day, label }) => (
                    <label
                      key={day}
                      className={chipClass(range?.first === day, 'rounded-full px-2')}
                    >
                      <input
                        type="radio"
                        name="firstDayChoice"
                        value={day}
                        checked={range?.first === day}
                        onChange={() => pickFirstDay(day)}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                  {!showEarlier && (
                    <button
                      type="button"
                      onClick={() => setShowEarlier(true)}
                      className={chipClass(false, 'rounded-full px-2')}
                    >
                      {t('Earlier…')}
                    </button>
                  )}
                </div>
                {errors.firstDayOff?.message && (
                  <p className="text-sm text-red-500">{t(errors.firstDayOff.message)}</p>
                )}
              </fieldset>

              <fieldset disabled={!range} className="space-y-3 disabled:opacity-50">
                <legend className="text-foreground mb-3 text-sm font-semibold">
                  {t('How many days off?')}
                </legend>
                <div className="grid grid-cols-7 gap-2">
                  {DAY_COUNTS.map((dayCount) => (
                    <label
                      key={dayCount}
                      className={chipClass(range?.dayCount === dayCount, 'rounded-xl')}
                    >
                      <input
                        type="radio"
                        name="dayCountChoice"
                        value={dayCount}
                        checked={range?.dayCount === dayCount}
                        onChange={() => pickDayCount(dayCount)}
                        aria-label={dayCountLabel(dayCount, locale)}
                        className="sr-only"
                      />
                      {dayCount}
                    </label>
                  ))}
                </div>
                {errors.lastDayOff?.message && (
                  <p className="text-sm text-red-500">{t(errors.lastDayOff.message)}</p>
                )}
              </fieldset>

              <div aria-live="polite">
                {range?.last && (
                  <CoverageSummary
                    first={range.first}
                    last={range.last}
                    destination={destination}
                    locale={locale}
                  />
                )}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={exactDates ? usePresets : () => setExactDates(true)}
            className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
          >
            {exactDates ? t('Pick from recent days instead') : t('Enter exact dates instead')} →
          </button>
        </FormCard>

        <FormNavigation
          backRoute={backRoute(ROUTE, savedData)}
          isSubmitting={isSubmitting}
          canSubmit={exactDates || Boolean(range?.last)}
        />
      </form>
    </FormLayout>
  )
}

function dayCountLabel(dayCount: number, locale: 'en' | 'es'): string {
  if (locale === 'es') return dayCount === 1 ? '1 día' : `${dayCount} días`
  return dayCount === 1 ? '1 day' : `${dayCount} days`
}

function CoverageSummary({
  first,
  last,
  destination,
  locale,
}: {
  first: DateOnly
  last: DateOnly
  destination: Destination
  locale: 'en' | 'es'
}) {
  const firstLabel = <strong>{formatDateOnly(first, 'weekdayLong', locale)}</strong>
  const lastLabel = <strong>{formatDateOnly(last, 'weekdayLong', locale)}</strong>
  const returnLabel = <strong>{formatDateOnly(addDays(last, 1), 'weekdayLong', locale)}</strong>
  const oneDay = first === last

  return (
    <p className="bg-primary/5 border-primary/15 text-foreground rounded-xl border px-4 py-3 text-base leading-relaxed">
      {locale === 'es' ? (
        <>
          Su nota cubrirá{' '}
          {oneDay ? (
            <>el {firstLabel}</>
          ) : (
            <>
              del {firstLabel} al {lastLabel}
            </>
          )}{' '}
          · regreso{' '}
          {destination === 'work' ? 'al trabajo ' : destination === 'school' ? 'a clases ' : ''}
          el {returnLabel}
        </>
      ) : (
        <>
          You&apos;ll be covered {firstLabel}
          {oneDay ? '' : <> through {lastLabel}</>} · back
          {destination === 'work' ? ' to work' : destination === 'school' ? ' to school' : ''}{' '}
          {returnLabel}
        </>
      )}
    </p>
  )
}
