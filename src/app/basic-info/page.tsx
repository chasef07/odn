'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLayout } from '@/components/form-layout'
import { FormCard } from '@/components/form/FormCard'
import { FormField } from '@/components/form/FormField'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { page2Schema } from '@/lib/validation-schemas'
import { isAgeValid } from '@/lib/age-validators'

const CURRENT_STEP = 3

type FormData = {
  patientFirstName: string
  patientLastName: string
  patientDateOfBirth: string
}

export default function BasicInfoPage() {
  const router = useRouter()
  const savedData = getFormData()
  const recipient = savedData.recipient || 'myself'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(page2Schema),
    defaultValues: {
      patientFirstName: savedData.patientFirstName || '',
      patientLastName: savedData.patientLastName || '',
      patientDateOfBirth: savedData.patientDateOfBirth || '',
    },
  })

  const onSubmit = (data: FormData) => {
    // Check age validation - only for "myself" option
    if (recipient === 'myself' && data.patientDateOfBirth) {
      if (!isAgeValid(data.patientDateOfBirth, 18)) {
        setError('patientDateOfBirth', {
          message: 'You must be 18 or older to request a note for yourself',
        })
        return
      }
    }

    saveFormData(data)

    // Navigate based on recipient
    if (recipient === 'someone_else') {
      router.push('/guardian-info')
    } else {
      router.push('/contact-info')
    }
  }

  // Dynamic title based on recipient
  const pageTitle =
    recipient === 'myself'
      ? 'What is your information?'
      : 'Please provide information about the person who needs this note'

  return (
    <FormLayout currentStep={CURRENT_STEP} title={pageTitle} description="">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormCard>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="patientFirstName"
              label="First Name"
              register={register('patientFirstName')}
              error={errors.patientFirstName}
              placeholder="Enter first name"
            />

            <FormField
              id="patientLastName"
              label="Last Name"
              register={register('patientLastName')}
              error={errors.patientLastName}
              placeholder="Enter last name"
            />
          </div>

          <FormField
            id="patientDateOfBirth"
            label="Date of Birth"
            type="date"
            register={register('patientDateOfBirth')}
            error={errors.patientDateOfBirth}
          />
        </FormCard>

        <FormNavigation backRoute="/who-is-using" isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
