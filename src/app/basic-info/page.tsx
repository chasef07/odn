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
import { patientSchema } from '@/lib/validation-schemas'
import type { z } from 'zod'

const CURRENT_STEP = 3

type FormData = z.input<typeof patientSchema>

export default function BasicInfoPage() {
  const router = useRouter()
  const savedData = getFormData()
  const recipient = savedData.recipient || 'myself'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    control,
  } = useForm<FormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      recipient: savedData.recipient ?? null,
      patientFirstName: savedData.patientFirstName || '',
      patientLastName: savedData.patientLastName || '',
      patientDateOfBirth: savedData.patientDateOfBirth || '',
    },
  })

  const patientDateOfBirth = useWatch({ control, name: 'patientDateOfBirth' }) || ''

  const handleNameChange =
    (field: 'patientFirstName' | 'patientLastName') => (e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (recipient === 'someone_else') {
      router.push('/guardian-info')
    } else {
      router.push('/contact-info')
    }
  }

  const pageTitle =
    recipient === 'myself'
      ? 'What is your information?'
      : 'Please provide information about the person who needs this note'

  return (
    <FormLayout currentStep={CURRENT_STEP} title={pageTitle} description="">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormCard>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="patientFirstName"
                label="First Name"
                register={register('patientFirstName', {
                  onChange: handleNameChange('patientFirstName'),
                })}
                error={errors.patientFirstName}
                placeholder="Enter first name"
              />

              <FormField
                id="patientLastName"
                label="Last Name"
                register={register('patientLastName', {
                  onChange: handleNameChange('patientLastName'),
                })}
                error={errors.patientLastName}
                placeholder="Enter last name"
              />
            </div>

            <DateOfBirthInput
              name="patientDateOfBirth"
              label="Date of Birth"
              value={patientDateOfBirth}
              onChange={(val) => setValue('patientDateOfBirth', val, { shouldValidate: false })}
              error={errors.patientDateOfBirth?.message}
            />
          </div>
        </FormCard>

        <FormNavigation backRoute="/who-is-using" isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
