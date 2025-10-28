import { ReactNode } from 'react';
import { FieldError, UseFormRegisterReturn } from 'react-hook-form';

interface RadioOption {
  value: string;
  label: string | ReactNode;
  description?: string;
}

interface FormRadioGroupProps {
  /** Unique field identifier */
  fieldName: string;

  /** Screen reader legend text */
  legend: string;

  /** Array of radio options */
  options: RadioOption[];

  /** React Hook Form register return value */
  register: UseFormRegisterReturn;

  /** Error object from react-hook-form */
  error?: FieldError;

  /** Currently selected value */
  selectedValue?: string;

  /** Grid layout classes (default: "grid gap-4 md:grid-cols-2") */
  gridClassName?: string;

  /** Variant style ("default" | "large-buttons" | "center-buttons") */
  variant?: 'default' | 'large-buttons' | 'center-buttons';
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
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>

      <div className={gridClassName}>
        {options.map((option) => {
          const isSelected = selectedValue === option.value;

          // Center buttons variant (for home page recipient selection)
          if (variant === 'center-buttons') {
            return (
              <label
                key={option.value}
                className={`inline-flex items-center justify-center rounded-lg border px-8 py-4 cursor-pointer transition-all shadow-sm ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                    : 'border-border/40 bg-white text-foreground hover:border-primary/40 hover:shadow-md'
                }`}
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register}
                  className="sr-only"
                  aria-describedby={error ? `${fieldName}-error` : undefined}
                />
                <span className="text-lg font-semibold">{option.label}</span>
              </label>
            );
          }

          // Large button variant (for note purpose page)
          if (variant === 'large-buttons') {
            return (
              <label
                key={option.value}
                className={`inline-flex items-center justify-center rounded-xl border px-6 py-3 text-center cursor-pointer transition-all shadow-sm ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                    : 'border-border/40 bg-white text-foreground hover:border-primary/40 hover:shadow-md'
                }`}
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register}
                  className="sr-only"
                  aria-describedby={error ? `${fieldName}-error` : undefined}
                />
                <span className="text-base font-semibold">{option.label}</span>
                {option.description && (
                  <span className="text-sm text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </label>
            );
          }

          // Default compact variant (for absence reason page)
          return (
            <label
              key={option.value}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all shadow-sm ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                  : 'border-border/40 bg-white text-foreground hover:border-primary/40 hover:shadow-md'
              }`}
            >
              <input
                type="radio"
                value={option.value}
                {...register}
                className="sr-only"
                aria-describedby={error ? `${fieldName}-error` : undefined}
              />
              <span className="text-sm font-medium">{option.label}</span>
            </label>
          );
        })}
      </div>

      {error && (
        <p id={`${fieldName}-error`} className="text-sm text-red-500 mt-2">
          {error.message}
        </p>
      )}
    </fieldset>
  );
}
