'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormLayout } from '@/components/form-layout'
import { FormCard } from '@/components/form/FormCard'
import { FormField } from '@/components/form/FormField'
import { FormNavigation } from '@/components/form/FormNavigation'
import { saveFormData, getFormData } from '@/lib/form-storage'
import { page3Schema } from '@/lib/validation-schemas'
import { formatPhoneNumber } from '@/lib/phone-utils'
import { PHONE_VALIDATION } from '@/lib/validation-constants'
import { useState } from 'react'

// Step number will be dynamic based on recipient

type FormData = {
  email: string
  phone: string
}

export default function ContactInfoPage() {
  const router = useRouter()
  const savedData = getFormData()
  const recipient = savedData.recipient || 'myself'
  const [phoneDisplay, setPhoneDisplay] = useState(savedData.phone || '')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(page3Schema),
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
    router.push('/note-purpose')
  }

  // Dynamic back route and step based on recipient
  const backRoute = recipient === 'someone_else' ? '/guardian-info' : '/basic-info'
  const currentStep = recipient === 'someone_else' ? 5 : 4

  return (
    <FormLayout
      currentStep={currentStep}
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

          {/* Phone - Custom formatting, can't use FormField */}
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
              maxLength={PHONE_VALIDATION.FORMATTED_LENGTH}
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

        <FormNavigation backRoute={backRoute} isSubmitting={isSubmitting} />
      </form>
    </FormLayout>
  )
}
