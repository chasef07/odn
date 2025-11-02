'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLayout } from '@/components/form-layout'
import { FormCard } from '@/components/form/FormCard'
import { FormField } from '@/components/form/FormField'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { guardianSchema } from '@/lib/validation-schemas'
import { isAgeValid } from '@/lib/age-validators'

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
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(guardianSchema),
    defaultValues: {
      guardianFirstName: savedData.guardianFirstName || '',
      guardianLastName: savedData.guardianLastName || '',
      guardianDateOfBirth: savedData.guardianDateOfBirth || '',
    },
  })

  const onSubmit = (data: FormData) => {
    // Check age validation - guardian must be 18+
    if (data.guardianDateOfBirth) {
      if (!isAgeValid(data.guardianDateOfBirth, 18)) {
        setError('guardianDateOfBirth', {
          message: 'You must be 18 or older to fill out this form',
        })
        return
      }
    }

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
              register={register('guardianFirstName')}
              error={errors.guardianFirstName}
              placeholder="Enter your first name"
            />

            <FormField
              id="guardianLastName"
              label="Last Name"
              register={register('guardianLastName')}
              error={errors.guardianLastName}
              placeholder="Enter your last name"
            />
          </div>

          <FormField
            id="guardianDateOfBirth"
            label="Date of Birth"
            type="date"
            register={register('guardianDateOfBirth')}
            error={errors.guardianDateOfBirth}
          />
        </FormCard>

        <FormNavigation backRoute="/basic-info" isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
