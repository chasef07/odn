import { SelectHTMLAttributes } from 'react'
import { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/components/i18n/I18nProvider'

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  /** Unique field identifier */
  id: string

  /** Display label text */
  label: string

  /** React Hook Form register return value */
  register: UseFormRegisterReturn

  /** Error object from react-hook-form */
  error?: FieldError

  /** Array of option values */
  options: string[]

  /** Placeholder text for empty option */
  placeholder?: string

  /** Whether field is required (default: true) */
  required?: boolean

  /** Height class ("h-12" | "h-14", default: "h-12") */
  height?: 'h-12' | 'h-14'

  /** Transform option value before displaying (default: no transformation) */
  valueTransform?: (value: string) => string

  /** Translate option labels (default: true). Keep proper names such as US states unchanged. */
  translateOptions?: boolean
}

export function FormSelect({
  id,
  label,
  register,
  error,
  options,
  placeholder = 'Select an option',
  required = true,
  height = 'h-12',
  valueTransform = (val) => val,
  translateOptions = true,
  ...props
}: FormSelectProps) {
  const { t } = useI18n()
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {t(label)}
      </Label>

      <select
        id={id}
        {...register}
        className={`${height} border-border/60 focus-visible:ring-primary/40 w-full rounded-xl border bg-white px-3 text-base focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50`}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      >
        <option value="">{t(placeholder)}</option>
        {options.map((option) => (
          <option key={option} value={valueTransform(option)}>
            {translateOptions ? t(option) : option}
          </option>
        ))}
      </select>

      {error && (
        <p id={`${id}-error`} className="text-sm text-red-500">
          {error.message ? t(error.message) : error.message}
        </p>
      )}
    </div>
  )
}
