import { FieldError, UseFormRegisterReturn } from 'react-hook-form'

interface CheckboxOption {
  value: string
  label: string
}

interface FormCheckboxGroupProps {
  /** Unique field identifier */
  fieldName: string

  /** Screen reader legend text */
  legend: string

  /** Array of checkbox options */
  options: CheckboxOption[]

  /** React Hook Form register return value */
  register: UseFormRegisterReturn

  /** Error object from react-hook-form */
  error?: FieldError

  /** Currently selected values */
  selectedValues?: string[]

  /** Grid layout classes (default: "grid gap-3 sm:grid-cols-2") */
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
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>

      <div className={gridClassName}>
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.value)

          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border/40 hover:border-primary/40 bg-white'
              }`}
            >
              <input
                type="checkbox"
                value={option.value}
                {...register}
                className="border-border/60 checked:bg-primary checked:border-primary focus-visible:ring-primary/40 h-4 w-4 rounded border-2 focus-visible:ring-2"
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? `${fieldName}-error` : undefined}
              />
              <span className="text-sm font-medium">{option.label}</span>
            </label>
          )
        })}
      </div>

      {error && (
        <p id={`${fieldName}-error`} className="mt-2 text-sm text-red-500">
          {error.message}
        </p>
      )}
    </fieldset>
  )
}
