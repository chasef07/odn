'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLayout } from '@/components/form-layout'
import { FormCard } from '@/components/form/FormCard'
import { FormField } from '@/components/form/FormField'
import { DateOfBirthInput } from '@/components/form/DateOfBirthInput'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { guardianSchema } from '@/lib/validation-schemas'

const CURRENT_STEP = 4

type FormData = {
  guardianFirstName: string
  guardianLastName: string
  guardianDateOfBirth: string
}

export default function GuardianInfoPage() {
  const router = useRouter()
  const savedData = getFormData()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    control,
  } = useForm<FormData>({
    resolver: zodResolver(guardianSchema),
    defaultValues: {
      guardianFirstName: savedData.guardianFirstName || '',
      guardianLastName: savedData.guardianLastName || '',
      guardianDateOfBirth: savedData.guardianDateOfBirth || '',
    },
  })

  const guardianDateOfBirth = useWatch({ control, name: 'guardianDateOfBirth' }) || ''

  const handleNameChange =
    (field: 'guardianFirstName' | 'guardianLastName') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const capitalized = e.target.value
        .split(/(\s+|-|')/)
        .map((part) => {
          if (part.match(/^\s+$/) || part === '-' || part === "'") return part
          if (part.length > 0) {
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          }
          return part
        })
        .join('')
      setValue(field, capitalized)
    }

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push('/contact-info')
  }

  return (
    <FormLayout currentStep={CURRENT_STEP} title="Now tell us about you" description="">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormCard>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="guardianFirstName"
              label="First Name"
              register={register('guardianFirstName', {
                onChange: handleNameChange('guardianFirstName'),
              })}
              error={errors.guardianFirstName}
              placeholder="Enter your first name"
            />

            <FormField
              id="guardianLastName"
              label="Last Name"
              register={register('guardianLastName', {
                onChange: handleNameChange('guardianLastName'),
              })}
              error={errors.guardianLastName}
              placeholder="Enter your last name"
            />
          </div>

          <DateOfBirthInput
            name="guardianDateOfBirth"
            label="Date of Birth"
            value={guardianDateOfBirth}
            onChange={(val) => setValue('guardianDateOfBirth', val, { shouldValidate: false })}
            error={errors.guardianDateOfBirth?.message}
          />
        </FormCard>

        <FormNavigation backRoute="/basic-info" isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
