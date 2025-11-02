'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLayout } from '@/components/form-layout'
import { FormRadioGroup } from '@/components/form/FormRadioGroup'
import { FormNavigation } from '@/components/form/FormNavigation'
import { Textarea } from '@/components/ui/textarea'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { page5Schema } from '@/lib/validation-schemas'
import { NOTE_PURPOSES } from '@/lib/form-constants'

// Step number will be dynamic based on recipient

const NOTE_PURPOSE_OPTIONS = [
  {
    value: 'work' as const,
    label: NOTE_PURPOSES.work.label,
  },
  {
    value: 'school' as const,
    label: NOTE_PURPOSES.school.label,
  },
  {
    value: 'both' as const,
    label: NOTE_PURPOSES.both.label,
  },
  {
    value: 'other' as const,
    label: NOTE_PURPOSES.other.label,
  },
]

type FormData = {
  notePurpose: 'work' | 'school' | 'both' | 'other' | null
  otherNotePurpose?: string
}

export default function NotePurposePage() {
  const router = useRouter()
  const savedData = getFormData()
  const recipient = savedData.recipient || 'myself'
  // Use guardian's first name if available (someone_else), otherwise use patient's first name
  const firstName = savedData.guardianFirstName || savedData.patientFirstName || ''
  const currentStep = recipient === 'someone_else' ? 6 : 5

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(page5Schema),
    defaultValues: {
      notePurpose: savedData.notePurpose || null,
      otherNotePurpose: savedData.otherNotePurpose || '',
    },
  })

  const selectedPurpose = watch('notePurpose')

  const onSubmit = (data: FormData) => {
    saveFormData(data)
    router.push('/absence-dates')
  }

  const title = firstName
    ? `Please tell us what you need a doctors note for, ${firstName}`
    : 'What do you need this note for?'

  return (
    <FormLayout currentStep={currentStep} title={title} description="" usePersonalization={true}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormRadioGroup
          fieldName="notePurpose"
          legend="What do you need this note for?"
          options={NOTE_PURPOSE_OPTIONS}
          register={register('notePurpose')}
          error={errors.notePurpose}
          selectedValue={selectedPurpose ?? undefined}
          variant="large-buttons"
        />

        {/* Show text input when "Other" is selected */}
        {selectedPurpose === 'other' && (
          <div className="space-y-2">
            <Textarea
              id="otherNotePurpose"
              {...register('otherNotePurpose')}
              className="border-border/60 focus-visible:ring-primary/40 min-h-[80px] resize-none rounded-xl text-base focus-visible:ring-2"
              placeholder="Please describe the purpose..."
              aria-required="true"
              aria-invalid={!!errors.otherNotePurpose}
              aria-describedby={errors.otherNotePurpose ? 'otherNotePurpose-error' : undefined}
            />
            {errors.otherNotePurpose && (
              <p id="otherNotePurpose-error" className="text-sm text-red-500">
                {errors.otherNotePurpose.message}
              </p>
            )}
          </div>
        )}

        <FormNavigation backRoute="/contact-info" isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
