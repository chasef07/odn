"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, subDays, differenceInDays } from 'date-fns';
import { FormLayout } from '@/components/form-layout';
import { FormCard } from '@/components/form/FormCard';
import { FormField } from '@/components/form/FormField';
import { FormNavigation } from '@/components/form/FormNavigation';
import { saveFormData, getFormData } from '@/lib/form-storage';
import { page6Schema } from '@/lib/validation-schemas';

const CURRENT_STEP = 6;

type FormData = {
  firstDayOff: string;
  lastDayOff: string;
};

export default function AbsenceDatesPage() {
  const router = useRouter();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<FormData>({
    resolver: zodResolver(page6Schema),
    defaultValues: {
      ...getFormData(),
      firstDayOff: getFormData().firstDayOff || today,
      lastDayOff: getFormData().lastDayOff || today,
    }
  });

  const onSubmit = (data: FormData) => {
    // Additional validation
    const now = new Date();
    const minStartDate = subDays(now, 7);
    const startDate = new Date(data.firstDayOff);
    const endDate = new Date(data.lastDayOff);

    if (startDate < minStartDate) {
      setError('firstDayOff', {
        message: 'Start date cannot be more than 7 days in the past'
      });
      return;
    }

    if (endDate < startDate) {
      setError('lastDayOff', {
        message: 'End date must be after start date'
      });
      return;
    }

    const daysDiff = differenceInDays(endDate, startDate);
    if (daysDiff > 7) {
      setError('lastDayOff', {
        message: 'Date range cannot exceed 7 days'
      });
      return;
    }

    saveFormData(data);
    router.push('/absence-reason');
  };

  return (
    <FormLayout
      currentStep={CURRENT_STEP}
      title="When do you need to be excused?"
      description="Select the dates you need covered by your doctor's note. We can cover up to 7 consecutive days."
      usePersonalization={true}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormCard>
          <FormField
            id="firstDayOff"
            label="First Day Off"
            type="date"
            register={register('firstDayOff')}
            error={errors.firstDayOff}
          />

          <FormField
            id="lastDayOff"
            label="Last Day Off"
            type="date"
            register={register('lastDayOff')}
            error={errors.lastDayOff}
          />
        </FormCard>

        <FormNavigation
          backRoute="/note-purpose"
          isSubmitting={isSubmitting}
        />
      </form>
    </FormLayout>
  );
}
