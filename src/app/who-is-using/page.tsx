'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProgress } from '@/components/form-progress'
import { FormRadioGroup } from '@/components/form/FormRadioGroup'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { page1Schema } from '@/lib/validation-schemas'
import { ShieldCheck, DollarSign } from 'lucide-react'
import { LocalizedPage } from '@/components/i18n/LocalizedPage'
import { LanguageSwitch } from '@/components/i18n/LanguageSwitch'

const CURRENT_STEP = 2

type FormData = {
  recipient: 'myself' | 'someone_else' | null
}

export default function WhoIsUsingPage() {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(page1Schema),
    defaultValues: getFormData(),
  })

  const recipient = useWatch({ control, name: 'recipient' })

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push('/basic-info')
  }

  return (
    <LocalizedPage>
      <div className="text-foreground min-h-screen bg-white">
        <main className="mx-auto w-full max-w-4xl px-6 py-8">
          <div className="mb-3 flex justify-end">
            <LanguageSwitch />
          </div>
          {/* Top Bar: Progress + Trust Badges */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <FormProgress currentStep={CURRENT_STEP} />
            </div>

            {/* Horizontal Trust Badges */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs sm:gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-primary h-4 w-4" />
                <span>HIPAA Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="text-primary h-4 w-4" />
                <span>Money back guarantee</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="mb-10 text-center">
            <h1 className="font-display text-foreground mb-4 text-4xl font-bold sm:text-5xl">
              Who is this note for?
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              If you are under the age of 18 please have your parent or guardian complete the form.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormRadioGroup
              fieldName="recipient"
              legend="Who is using this note?"
              options={[
                { value: 'myself', label: 'Myself' },
                { value: 'someone_else', label: 'Someone else' },
              ]}
              register={register('recipient')}
              error={errors.recipient}
              selectedValue={recipient ?? undefined}
              variant="center-buttons"
              gridClassName="flex flex-wrap gap-4 justify-center"
            />

            <FormNavigation backRoute="/get-started" isSubmitting={isSubmitting} />
          </form>
        </main>
      </div>
    </LocalizedPage>
  )
}
