'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProgress } from '@/components/form-progress'
import { FormRadioGroup } from '@/components/form/FormRadioGroup'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { recipientSchema } from '@/lib/validation-schemas'
import { backRoute, nextRoute } from '@/lib/intake'
import { ShieldCheck, DollarSign } from 'lucide-react'
import { LocalizedPage } from '@/components/i18n/LocalizedPage'
import { LanguageSwitch } from '@/components/i18n/LanguageSwitch'

const ROUTE = '/who-is-using'

type FormData = {
  recipient: 'myself' | 'someone_else' | null
}

export default function WhoIsUsingPage() {
  const router = useRouter()
  const savedData = getFormData()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(recipientSchema),
    defaultValues: savedData,
  })

  const recipient = useWatch({ control, name: 'recipient' })

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push(nextRoute(ROUTE, getFormData()))
  }

  return (
    <LocalizedPage>
      <div className="text-foreground min-h-dvh bg-white">
        <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-3 flex justify-end">
            <LanguageSwitch />
          </div>
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <FormProgress route={ROUTE} />
            </div>

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

          <div className="mb-6 text-center sm:mb-10">
            <h1 className="font-display text-foreground mb-4 text-3xl font-bold sm:text-5xl">
              Who is this note for?
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-base sm:text-lg">
              If you are under the age of 18 please have your parent or guardian complete the form.
            </p>
          </div>

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
              gridClassName="grid gap-3 sm:flex sm:flex-wrap sm:justify-center sm:gap-4"
            />

            <FormNavigation backRoute={backRoute(ROUTE, savedData)} isSubmitting={isSubmitting} />
          </form>
        </main>
      </div>
    </LocalizedPage>
  )
}
