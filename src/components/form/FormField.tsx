import { InputHTMLAttributes } from 'react'
import { FieldError, UseFormRegisterReturn } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/components/i18n/I18nProvider'

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string

  label: string

  register: UseFormRegisterReturn

  error?: FieldError

  type?: string

  placeholder?: string

  required?: boolean
}

export function FormField({
  id,
  label,
  register,
  error,
  type = 'text',
  placeholder,
  required = true,
  className,
  ...props
}: FormFieldProps) {
  const { t } = useI18n()
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {t(label)}
      </Label>

      <Input
        id={id}
        type={type}
        {...register}
        className={`border-border/60 focus-visible:ring-primary/40 h-12 rounded-xl border bg-white text-base focus-visible:ring-2 ${className || ''}`}
        placeholder={placeholder ? t(placeholder) : undefined}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />

      {error && (
        <p id={`${id}-error`} className="text-sm text-red-500">
          {error.message ? t(error.message) : error.message}
        </p>
      )}
    </div>
  )
}
