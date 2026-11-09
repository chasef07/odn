import { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Check } from 'lucide-react'
import { useI18n } from '@/components/i18n/I18nProvider'

interface RadioOption {
  value: string
  label: string
}

interface FormRadioGroupProps {
  fieldName: string

  legend: string

  options: RadioOption[]

  register: UseFormRegisterReturn

  error?: FieldError

  selectedValue?: string
}

export function FormRadioGroup({
  fieldName,
  legend,
  options,
  register,
  error,
  selectedValue,
}: FormRadioGroupProps) {
  const { t } = useI18n()
  return (
    <fieldset>
      <legend className="sr-only">{t(legend)}</legend>

      <div className="grid gap-3">
        {options.map((option) => {
          const isSelected = selectedValue === option.value

          return (
            <label
              key={option.value}
              className={`has-[:focus-visible]:ring-primary/40 relative flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all active:scale-[0.98] has-[:focus-visible]:ring-2 ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 bg-white'
              }`}
            >
              <input
                type="radio"
                value={option.value}
                {...register}
                className="sr-only"
                aria-describedby={error ? `${fieldName}-error` : undefined}
              />
              <span className="text-foreground text-base font-medium">{t(option.label)}</span>
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isSelected ? 'border-primary bg-primary' : 'border-border'
                }`}
              >
                {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </span>
            </label>
          )
        })}
      </div>

      {error && (
        <p id={`${fieldName}-error`} className="mt-2 text-sm text-red-500">
          {error.message ? t(error.message) : error.message}
        </p>
      )}
    </fieldset>
  )
}
