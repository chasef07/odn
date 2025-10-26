"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { differenceInYears } from 'date-fns';
import { FormLayout } from '@/components/form-layout';
import { FormCard } from '@/components/form/FormCard';
import { FormField } from '@/components/form/FormField';
import { FormNavigation } from '@/components/form/FormNavigation';
import { saveFormData, getFormData } from '@/lib/form-storage';
import { page2Schema } from '@/lib/validation-schemas';

const CURRENT_STEP = 2;

type FormData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
};

export default function BasicInfoPage() {
  const router = useRouter();

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<FormData>({
    resolver: zodResolver(page2Schema),
    defaultValues: getFormData()
  });

  const onSubmit = (data: FormData) => {
    // Check age validation based on recipient
    const savedData = getFormData();
    const recipient = savedData.recipient || 'myself';

    if (recipient === 'myself' && data.dateOfBirth) {
      const birthDate = new Date(data.dateOfBirth);
      const age = differenceInYears(new Date(), birthDate);

      if (age < 18) {
        setError('dateOfBirth', {
          message: 'You must be 18 or older to request a note for yourself'
        });
        return;
      }
    }

    saveFormData(data);
    router.push('/contact-info');
  };

  return (
    <FormLayout
      currentStep={CURRENT_STEP}
      title="Tell us about yourself"
      description=""
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="firstName"
              label="First Name"
              register={register('firstName')}
              error={errors.firstName}
              placeholder="Enter your first name"
            />

            <FormField
              id="lastName"
              label="Last Name"
              register={register('lastName')}
              error={errors.lastName}
              placeholder="Enter your last name"
            />
          </div>

          <FormField
            id="dateOfBirth"
            label="Date of Birth"
            type="date"
            register={register('dateOfBirth')}
            error={errors.dateOfBirth}
          />
        </FormCard>

        <FormNavigation
          backRoute="/"
          isSubmitting={isSubmitting}
        />
      </form>
    </FormLayout>
  );
}
