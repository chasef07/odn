import { SelectHTMLAttributes } from 'react'
import { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/components/i18n/I18nProvider'

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string

  label: string

  register: UseFormRegisterReturn

  error?: FieldError

  options: string[]

  placeholder?: string

  required?: boolean

  height?: 'h-12' | 'h-14'

  valueTransform?: (value: string) => string

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
