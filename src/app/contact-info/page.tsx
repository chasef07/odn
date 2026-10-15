'use client'

import { useLocalizedRouter as useRouter } from '@/components/i18n/useLocalizedRouter'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormLayout } from '@/components/form-layout'
import { FormCard } from '@/components/form/FormCard'
import { FormField } from '@/components/form/FormField'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { backRoute, nextRoute } from '@/lib/intake'
import { contactSchema } from '@/lib/validation-schemas'
import { formatPhoneNumber } from '@/lib/phone-utils'
import { useState } from 'react'

const ROUTE = '/contact-info'

type FormData = {
  email: string
  phone: string
}

export default function ContactInfoPage() {
  const router = useRouter()
  const savedData = getFormData()
  const [phoneDisplay, setPhoneDisplay] = useState(savedData.phone || '')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      email: savedData.email || '',
      phone: savedData.phone || '',
    },
  })

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhoneDisplay(formatted)
    setValue('phone', formatted)
  }

  const onSubmit = (data: FormData) => {
    saveFormData(data)

    router.push(nextRoute(ROUTE, getFormData()))
  }

  return (
    <FormLayout
      route={ROUTE}
      title="How can we reach you?"
      description="Your information is private and will never be used for marketing purposes."
      usePersonalization={true}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormCard>
          <FormField
            id="email"
            label="Email Address"
            type="email"
            register={register('email')}
            error={errors.email}
            placeholder="your.email@example.com"
          />

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phoneDisplay}
              onChange={handlePhoneChange}
              className="border-border/60 focus-visible:ring-primary/40 h-12 rounded-xl border bg-white text-base focus-visible:ring-2"
              placeholder="(555) 123-4567"
              aria-required="true"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'phone-error' : undefined}
            />
            {errors.phone && (
              <p id="phone-error" className="text-sm text-red-500">
                {errors.phone.message}
              </p>
            )}
          </div>
        </FormCard>

        <FormNavigation backRoute={backRoute(ROUTE, savedData)} isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
