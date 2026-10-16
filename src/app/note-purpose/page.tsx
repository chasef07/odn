'use client'

import { useState } from 'react'
import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
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
import { backRoute, nextRoute } from '@/lib/intake'
import { LEGAL_NOTE_PURPOSE_ERROR, notePurposeSchema } from '@/lib/validation-schemas'
import { NOTE_PURPOSES } from '@/lib/form-constants'
import { useI18n } from '@/components/i18n/I18nProvider'

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

const ROUTE = '/note-purpose'

type NotePurpose = 'work' | 'school' | 'both' | 'travel' | 'legal' | 'other'

type FormData = {
  notePurpose: NotePurpose | null
  otherNotePurpose?: string
}

export default function NotePurposePage() {
  const router = useRouter()
  const savedData = getFormData()
  const patientFirstName = savedData.patientFirstName || ''
  const [showLegalMatterDialog, setShowLegalMatterDialog] = useState(
    savedData.notePurpose === 'legal'
  )
  const { locale } = useI18n()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(notePurposeSchema),
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
    saveFormData(data)

    router.push(nextRoute(ROUTE, getFormData()))
  }

  const title = patientFirstName
    ? locale === 'es'
      ? `Cuéntenos para qué necesita ${patientFirstName} una nota médica.`
      : `Please tell us what ${patientFirstName} needs a doctor's note for?`
    : 'What do you need this note for?'

  return (
    <FormLayout route={ROUTE} title={title} description="" usePersonalization={true}>
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

        <FormNavigation backRoute={backRoute(ROUTE, savedData)} isSubmitting={isSubmitting} />
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
