import { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { useI18n } from '@/components/i18n/I18nProvider'

interface CheckboxOption {
  value: string
  label: string
}

interface FormCheckboxGroupProps {
  fieldName: string

  legend: string

  options: CheckboxOption[]

  register: UseFormRegisterReturn

  error?: FieldError

  selectedValues?: string[]

  gridClassName?: string
}

export function FormCheckboxGroup({
  fieldName,
  legend,
  options,
  register,
  error,
  selectedValues = [],
  gridClassName = 'grid gap-3 sm:grid-cols-2',
}: FormCheckboxGroupProps) {
  const { t } = useI18n()
  return (
    <fieldset>
      <legend className="sr-only">{t(legend)}</legend>

      <div className={gridClassName}>
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.value)

          return (
            <label
              key={option.value}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border/40 hover:border-primary/40 bg-white'
              }`}
            >
              <input
                type="checkbox"
                value={option.value}
                {...register}
                className="border-border/60 checked:bg-primary checked:border-primary focus-visible:ring-primary/40 h-5 w-5 shrink-0 rounded border-2 focus-visible:ring-2 sm:h-4 sm:w-4"
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? `${fieldName}-error` : undefined}
              />
              <span className="text-sm font-medium">{t(option.label)}</span>
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
