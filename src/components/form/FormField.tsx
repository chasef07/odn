import { InputHTMLAttributes } from 'react';
import { FieldError, UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Unique field identifier */
  id: string;

  /** Display label text */
  label: string;

  /** React Hook Form register return value */
  register: UseFormRegisterReturn;

  /** Error object from react-hook-form */
  error?: FieldError;

  /** Input type (default: "text") */
  type?: string;

  /** Placeholder text */
  placeholder?: string;

  /** Whether field is required (default: true) */
  required?: boolean;
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
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>

      <Input
        id={id}
        type={type}
        {...register}
        className={`h-12 rounded-xl border border-border/60 bg-white text-base focus-visible:ring-2 focus-visible:ring-primary/40 ${className || ''}`}
        placeholder={placeholder}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />

      {error && (
        <p id={`${id}-error`} className="text-sm text-red-500">
          {error.message}
        </p>
      )}
    </div>
  );
}
