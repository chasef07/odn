import { ReactNode } from 'react'
import { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { useI18n } from '@/components/i18n/I18nProvider'

interface RadioOption {
  value: string
  label: string | ReactNode
  description?: string
}

interface FormRadioGroupProps {
  /** Unique field identifier */
  fieldName: string

  /** Screen reader legend text */
  legend: string

  /** Array of radio options */
  options: RadioOption[]

  /** React Hook Form register return value */
  register: UseFormRegisterReturn

  /** Error object from react-hook-form */
  error?: FieldError

  /** Currently selected value */
  selectedValue?: string

  /** Grid layout classes (default: "grid gap-4 md:grid-cols-2") */
  gridClassName?: string

  /** Variant style ("default" | "large-buttons" | "center-buttons") */
  variant?: 'default' | 'large-buttons' | 'center-buttons'
}

export function FormRadioGroup({
  fieldName,
  legend,
  options,
  register,
  error,
  selectedValue,
  gridClassName = 'grid gap-4 md:grid-cols-2',
  variant = 'default',
}: FormRadioGroupProps) {
  const { t } = useI18n()
  return (
    <fieldset>
      <legend className="sr-only">{t(legend)}</legend>

      <div className={gridClassName}>
        {options.map((option) => {
          const isSelected = selectedValue === option.value

          // Center buttons variant (for home page recipient selection)
          if (variant === 'center-buttons') {
            return (
              <label
                key={option.value}
                className={`inline-flex cursor-pointer items-center justify-center rounded-lg border px-8 py-4 shadow-sm transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary ring-primary/20 ring-2'
                    : 'border-border/40 text-foreground hover:border-primary/40 bg-white hover:shadow-md'
                }`}
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register}
                  className="sr-only"
                  aria-describedby={error ? `${fieldName}-error` : undefined}
                />
                <span className="text-lg font-semibold">
                  {typeof option.label === 'string' ? t(option.label) : option.label}
                </span>
              </label>
            )
          }

          // Large button variant (for note purpose page)
          if (variant === 'large-buttons') {
            return (
              <label
                key={option.value}
                className={`inline-flex cursor-pointer items-center justify-center rounded-xl border px-6 py-3 text-center shadow-sm transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary ring-primary/20 ring-2'
                    : 'border-border/40 text-foreground hover:border-primary/40 bg-white hover:shadow-md'
                }`}
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register}
                  className="sr-only"
                  aria-describedby={error ? `${fieldName}-error` : undefined}
                />
                <span className="text-base font-semibold">
                  {typeof option.label === 'string' ? t(option.label) : option.label}
                </span>
                {option.description && (
                  <span className="text-muted-foreground text-sm">{t(option.description)}</span>
                )}
              </label>
            )
          }

          // Default compact variant (for absence reason page)
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 shadow-sm transition-all ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary ring-primary/20 ring-2'
                  : 'border-border/40 text-foreground hover:border-primary/40 bg-white hover:shadow-md'
              }`}
            >
              <input
                type="radio"
                value={option.value}
                {...register}
                className="sr-only"
                aria-describedby={error ? `${fieldName}-error` : undefined}
              />
              <span className="text-sm font-medium">
                {typeof option.label === 'string' ? t(option.label) : option.label}
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
