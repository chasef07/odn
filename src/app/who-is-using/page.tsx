'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLayout } from '@/components/form-layout'
import { FormRadioGroup } from '@/components/form/FormRadioGroup'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { recipientSchema } from '@/lib/validation-schemas'
import { backRoute, nextRoute } from '@/lib/intake'

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
    <FormLayout
      route={ROUTE}
      backHref={backRoute(ROUTE, savedData)}
      title="Who is this note for?"
      description="If you are under the age of 18 please have your parent or guardian complete the form."
    >
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
        />

        <FormNavigation isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
