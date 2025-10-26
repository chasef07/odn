"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormLayout } from '@/components/form-layout';
import { FormCard } from '@/components/form/FormCard';
import { FormSelect } from '@/components/form/FormSelect';
import { FormNavigation } from '@/components/form/FormNavigation';
import { saveFormData, getFormData } from '@/lib/form-storage';
import { page4Schema } from '@/lib/validation-schemas';
import { AVAILABLE_STATES } from '@/lib/form-constants';

const CURRENT_STEP = 4;

type FormData = {
  state: string;
};

export default function StatePage() {
  const router = useRouter();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(page4Schema),
    defaultValues: getFormData()
  });

  const onSubmit = (data: FormData) => {
    saveFormData(data);
    router.push('/note-purpose');
  };

  return (
    <FormLayout
      currentStep={CURRENT_STEP}
      title="Where are you located?"
      description="Select your state to ensure we can serve you."
      usePersonalization={true}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormCard spacing="space-y-2">
          <FormSelect
            id="state"
            label="State"
            options={AVAILABLE_STATES}
            placeholder="Select your state"
            register={register('state')}
            error={errors.state}
          />
        </FormCard>

        <FormNavigation
          backRoute="/contact-info"
          isSubmitting={isSubmitting}
        />
      </form>
    </FormLayout>
  );
}
