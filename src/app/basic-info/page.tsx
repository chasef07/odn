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
import { backRoute, nextRoute } from '@/lib/intake'
import { capitalizeName } from '@/lib/name-case'

const ROUTE = '/basic-info'

type FormData = z.input<typeof patientSchema>

export default function BasicInfoPage() {
  const router = useRouter()
  const savedData = getFormData()
  const recipient = savedData.recipient || 'myself'
  const isForSelf = recipient === 'myself'

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
      setValue(field, capitalizeName(e.target.value))
    }

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push(nextRoute(ROUTE, getFormData()))
  }

  const pageTitle = isForSelf
    ? 'What is your information?'
    : 'Please provide information about the person who needs this note'

  return (
    <FormLayout route={ROUTE} title={pageTitle} description="">
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
                autoComplete={isForSelf ? 'given-name' : 'off'}
                placeholder="Enter first name"
              />

              <FormField
                id="patientLastName"
                label="Last Name"
                register={register('patientLastName', {
                  onChange: handleNameChange('patientLastName'),
                })}
                error={errors.patientLastName}
                autoComplete={isForSelf ? 'family-name' : 'off'}
                placeholder="Enter last name"
              />
            </div>

            <DateOfBirthInput
              name="patientDateOfBirth"
              label="Date of Birth"
              value={patientDateOfBirth}
              onChange={(val) => setValue('patientDateOfBirth', val, { shouldValidate: false })}
              error={errors.patientDateOfBirth?.message}
              autofill={isForSelf}
            />
          </div>
        </FormCard>

        <FormNavigation backRoute={backRoute(ROUTE, savedData)} isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
