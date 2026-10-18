'use client'

import { useRef, useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { ageOn, parseDateOnly, todayInViewerZone } from '@/lib/dates'
import { DATE_LIMITS } from '@/lib/validation-constants'
import { useI18n } from '@/components/i18n/I18nProvider'

interface DateOfBirthInputProps {
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}

export function DateOfBirthInput({ name, label, value, onChange, error }: DateOfBirthInputProps) {
  const { t } = useI18n()
  const [year, month, day] = value ? value.split('-') : ['', '', '']

  const [mm, setMm] = useState(month || '')
  const [dd, setDd] = useState(day || '')
  const [yyyy, setYyyy] = useState(year || '')

  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)
  const yearRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-')
      if (y && m && d) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync split date inputs from an external form value
        setYyyy(y)
        setMm(m)
        setDd(d)
      }
    }
  }, [value])

  const emitChange = (newMm: string, newDd: string, newYyyy: string) => {
    if (newMm && newDd && newYyyy.length === 4) {
      const padded = `${newYyyy}-${newMm.padStart(2, '0')}-${newDd.padStart(2, '0')}`
      onChange(padded)
    } else if (!newMm && !newDd && !newYyyy) {
      onChange('')
    }
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2)

    if (raw.length === 1 && parseInt(raw) > 1) {
      const padded = '0' + raw
      setMm(padded)
      emitChange(padded, dd, yyyy)
      dayRef.current?.focus()
      return
    }

    if (raw.length === 2) {
      const num = parseInt(raw)
      if (num < 1 || num > 12) return
      setMm(raw)
      emitChange(raw, dd, yyyy)
      dayRef.current?.focus()
      return
    }

    setMm(raw)
    emitChange(raw, dd, yyyy)
  }

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2)

    if (raw.length === 1 && parseInt(raw) > 3) {
      const padded = '0' + raw
      setDd(padded)
      emitChange(mm, padded, yyyy)
      yearRef.current?.focus()
      return
    }

    if (raw.length === 2) {
      const num = parseInt(raw)
      if (num < 1 || num > 31) return
      setDd(raw)
      emitChange(mm, raw, yyyy)
      yearRef.current?.focus()
      return
    }

    setDd(raw)
    emitChange(mm, raw, yyyy)
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
    setYyyy(raw)
    emitChange(mm, dd, raw)
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: 'month' | 'day' | 'year'
  ) => {
    if (e.key === 'Backspace') {
      const target = e.target as HTMLInputElement
      if (target.value === '') {
        if (field === 'day') {
          monthRef.current?.focus()
        } else if (field === 'year') {
          dayRef.current?.focus()
        }
      }
    }
  }

  const computedAge = (() => {
    const dateOfBirth = parseDateOnly(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`)
    const today = todayInViewerZone()
    if (!dateOfBirth || dateOfBirth < DATE_LIMITS.EARLIEST_DATE_OF_BIRTH || dateOfBirth > today) {
      return null
    }
    return ageOn(dateOfBirth, today)
  })()

  const inputClasses =
    'border-border/60 focus-visible:ring-primary/40 h-12 rounded-xl border bg-white text-base text-center focus-visible:ring-2 outline-none px-2'
  const invalidClasses = error ? 'border-red-500' : ''

  return (
    <div className="space-y-2">
      <Label htmlFor={`${name}-month`} className="text-sm font-medium">
        {t(label)}
      </Label>

      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center">
          <input
            ref={monthRef}
            id={`${name}-month`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="MM"
            value={mm}
            onChange={handleMonthChange}
            onKeyDown={(e) => handleKeyDown(e, 'month')}
            className={`${inputClasses} ${invalidClasses} w-16`}
            maxLength={2}
            aria-label={t('Month')}
            aria-required="true"
            aria-invalid={!!error}
            aria-describedby={error ? `${name}-error` : undefined}
            autoComplete="bday-month"
          />
        </div>

        <span className="text-muted-foreground text-lg">/</span>

        <div className="flex flex-col items-center">
          <input
            ref={dayRef}
            id={`${name}-day`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="DD"
            value={dd}
            onChange={handleDayChange}
            onKeyDown={(e) => handleKeyDown(e, 'day')}
            className={`${inputClasses} ${invalidClasses} w-16`}
            maxLength={2}
            aria-label={t('Day')}
            aria-required="true"
            aria-invalid={!!error}
            aria-describedby={error ? `${name}-error` : undefined}
            autoComplete="bday-day"
          />
        </div>

        <span className="text-muted-foreground text-lg">/</span>

        <div className="flex flex-col items-center">
          <input
            ref={yearRef}
            id={`${name}-year`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="YYYY"
            value={yyyy}
            onChange={handleYearChange}
            onKeyDown={(e) => handleKeyDown(e, 'year')}
            className={`${inputClasses} ${invalidClasses} w-20`}
            maxLength={4}
            aria-label={t('Year')}
            aria-required="true"
            aria-invalid={!!error}
            aria-describedby={error ? `${name}-error` : undefined}
            autoComplete="bday-year"
          />
        </div>
      </div>

      {computedAge !== null && (
        <p className="text-muted-foreground text-sm">
          {t('Age:')}{' '}
          <span className="text-foreground font-medium">
            {computedAge} {t('years old')}
          </span>
        </p>
      )}

      {error && (
        <p id={`${name}-error`} className="text-sm text-red-500">
          {t(error)}
        </p>
      )}
    </div>
  )
}
