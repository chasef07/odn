import { SelectHTMLAttributes } from 'react';
import { FieldError, UseFormRegisterReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  /** Unique field identifier */
  id: string;

  /** Display label text */
  label: string;

  /** React Hook Form register return value */
  register: UseFormRegisterReturn;

  /** Error object from react-hook-form */
  error?: FieldError;

  /** Array of option values */
  options: string[];

  /** Placeholder text for empty option */
  placeholder?: string;

  /** Whether field is required (default: true) */
  required?: boolean;

  /** Height class ("h-12" | "h-14", default: "h-12") */
  height?: 'h-12' | 'h-14';

  /** Transform option value before displaying (default: lowercase) */
  valueTransform?: (value: string) => string;
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
  valueTransform = (val) => val.toLowerCase(),
  ...props
}: FormSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>

      <select
        id={id}
        {...register}
        className={`${height} w-full rounded-xl border border-border/60 bg-white px-3 text-base focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50`}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={valueTransform(option)}>
            {option}
          </option>
        ))}
      </select>

      {error && (
        <p id={`${id}-error`} className="text-sm text-red-500">
          {error.message}
        </p>
      )}
    </div>
  );
}
