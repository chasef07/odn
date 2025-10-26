"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormLayout } from '@/components/form-layout';
import { FormCard } from '@/components/form/FormCard';
import { FormField } from '@/components/form/FormField';
import { FormNavigation } from '@/components/form/FormNavigation';
import { saveFormData, getFormData } from '@/lib/form-storage';
import { page3Schema } from '@/lib/validation-schemas';
import { useState } from 'react';

const CURRENT_STEP = 3;

type FormData = {
  email: string;
  phone: string;
};

// Format phone number as (555) 123-4567
const formatPhoneNumber = (value: string) => {
  // Remove all non-digits
  const phoneNumber = value.replace(/\D/g, '');

  // Apply formatting
  if (phoneNumber.length <= 3) {
    return phoneNumber;
  } else if (phoneNumber.length <= 6) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  } else {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  }
};

export default function ContactInfoPage() {
  const router = useRouter();
  const savedData = getFormData();
  const [phoneDisplay, setPhoneDisplay] = useState(savedData.phone || '');

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(page3Schema),
    defaultValues: {
      email: savedData.email || '',
      phone: savedData.phone || ''
    }
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneDisplay(formatted);
    setValue('phone', formatted);
  };

  const onSubmit = (data: FormData) => {
    saveFormData(data);
    router.push('/state');
  };

  return (
    <FormLayout
      currentStep={CURRENT_STEP}
      title="How can we reach you?"
      description=""
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
              className="h-12 rounded-xl border border-border/60 bg-white text-base focus-visible:ring-2 focus-visible:ring-primary/40"
              placeholder="(555) 123-4567"
              maxLength={14}
              aria-required="true"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? "phone-error" : undefined}
            />
            {errors.phone && (
              <p id="phone-error" className="text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>
        </FormCard>

        <FormNavigation
          backRoute="/basic-info"
          isSubmitting={isSubmitting}
        />
      </form>
    </FormLayout>
  );
}
