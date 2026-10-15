'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { FormLayout } from '@/components/form-layout'
import { FormCard } from '@/components/form/FormCard'
import { FormField } from '@/components/form/FormField'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { backRoute, nextRoute } from '@/lib/intake'
import { absenceDatesSchema } from '@/lib/validation-schemas'

const ROUTE = '/absence-dates'

type FormData = {
  firstDayOff: string
  lastDayOff: string
}

export default function AbsenceDatesPage() {
  const router = useRouter()
  const today = format(new Date(), 'yyyy-MM-dd')
  const savedData = getFormData()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(absenceDatesSchema),
    defaultValues: {
      firstDayOff: savedData.firstDayOff || today,
      lastDayOff: savedData.lastDayOff || today,
    },
  })

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push(nextRoute(ROUTE, getFormData()))
  }

  return (
    <FormLayout
      route={ROUTE}
      title="When do you need to be excused?"
      description="Select the dates you need covered by your doctor's note. We can cover up to 7 consecutive days."
      usePersonalization={true}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormCard spacing="space-y-4">
          <div className="max-w-[240px]">
            <FormField
              id="firstDayOff"
              label="First Day Off"
              type="date"
              register={register('firstDayOff')}
              error={errors.firstDayOff}
            />
          </div>

          <div className="max-w-[240px]">
            <FormField
              id="lastDayOff"
              label="Last Day Off"
              type="date"
              register={register('lastDayOff')}
              error={errors.lastDayOff}
            />
          </div>
        </FormCard>

        <FormNavigation backRoute={backRoute(ROUTE, savedData)} isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
