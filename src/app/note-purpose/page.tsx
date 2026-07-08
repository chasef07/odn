'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLayout } from '@/components/form-layout'
import { FormRadioGroup } from '@/components/form/FormRadioGroup'
import { FormNavigation } from '@/components/form/FormNavigation'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { getBackRoute, getNextRoute, getStepNumber } from '@/lib/form-steps'
import { LEGAL_NOTE_PURPOSE_ERROR, page5Schema } from '@/lib/validation-schemas'
import { NOTE_PURPOSES } from '@/lib/form-constants'

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
    value: 'travel' as const,
    label: NOTE_PURPOSES.travel.label,
  },
  {
    value: 'legal' as const,
    label: 'Legal Matters (Court, Jury Duty, Probation)',
  },
  {
    value: 'other' as const,
    label: NOTE_PURPOSES.other.label,
  },
]

type NotePurpose = 'work' | 'school' | 'both' | 'travel' | 'legal' | 'other'

type FormData = {
  notePurpose: NotePurpose | null
  otherNotePurpose?: string
}

export default function NotePurposePage() {
  const router = useRouter()
  const savedData = getFormData()
  const recipient = savedData.recipient || 'myself'
  const patientFirstName = savedData.patientFirstName || ''
  const currentStep = getStepNumber('/note-purpose', recipient)
  const [showLegalMatterDialog, setShowLegalMatterDialog] = useState(
    savedData.notePurpose === 'legal'
  )

  const {
    register,
    handleSubmit,
    control,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(page5Schema),
    defaultValues: {
      notePurpose: savedData.notePurpose || null,
      otherNotePurpose: savedData.otherNotePurpose || '',
    },
  })

  const selectedPurpose = useWatch({ control, name: 'notePurpose' })
  const notePurposeRegister = register('notePurpose', {
    onChange: (event) => {
      if (event.target.value === 'legal') {
        setShowLegalMatterDialog(true)
      }
    },
  })

  const dismissLegalMatterDialog = () => {
    setShowLegalMatterDialog(false)
    setValue('notePurpose', null, { shouldDirty: true })
    clearErrors('notePurpose')
  }

  const handleLegalMatterDialogChange = (open: boolean) => {
    if (open) {
      setShowLegalMatterDialog(true)
      return
    }

    dismissLegalMatterDialog()
  }

  const onSubmit = (data: FormData) => {
    if (data.notePurpose === 'legal') {
      setShowLegalMatterDialog(true)
      return
    }

    saveFormData(data)

    router.push(getNextRoute('/note-purpose', recipient)!)
  }

  const title = patientFirstName
    ? `Please tell us what ${patientFirstName} needs a doctor's note for?`
    : 'What do you need this note for?'

  return (
    <FormLayout currentStep={currentStep} title={title} description="" usePersonalization={true}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormRadioGroup
          fieldName="notePurpose"
          legend="What do you need this note for?"
          options={NOTE_PURPOSE_OPTIONS}
          register={notePurposeRegister}
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

        <FormNavigation
          backRoute={getBackRoute('/note-purpose', recipient)!}
          isSubmitting={isSubmitting}
        />
      </form>

      <Dialog open={showLegalMatterDialog} onOpenChange={handleLegalMatterDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Legal matters are not eligible</DialogTitle>
            <DialogDescription className="text-base leading-6">
              {LEGAL_NOTE_PURPOSE_ERROR}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={dismissLegalMatterDialog}>
              Choose another reason
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormLayout>
  )
}
