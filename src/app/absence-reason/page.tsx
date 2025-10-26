"use client";

import { useRouter } from "next/navigation";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormLayout } from "@/components/form-layout";
import { FormRadioGroup } from '@/components/form/FormRadioGroup';
import { FormNavigation } from '@/components/form/FormNavigation';
import { saveFormData, getFormData } from "@/lib/form-storage";
import { page7Schema } from '@/lib/validation-schemas';
import { ABSENCE_REASONS } from "@/lib/form-constants";

const CURRENT_STEP = 7;

type FormData = {
  absenceReason: string;
};

export default function AbsenceReasonPage() {
  const router = useRouter();
  const savedData = getFormData();
  const firstName = savedData.firstName || '';
  const recipient = savedData.recipient || '';

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(page7Schema),
    defaultValues: getFormData()
  });

  const selectedReason = watch('absenceReason');

  // Build absence reason options with conditional "Taking care of family"
  const absenceReasonOptions = [
    ...ABSENCE_REASONS.filter(r => r !== 'Medical appointment' && r !== 'Other'),
    ...(recipient === 'someone_else' ? ['Taking care of family'] : []),
    'Medical appointment',
    'Other',
  ];

  const onSubmit = (data: FormData) => {
    // Clear symptoms when absence reason changes
    const previousReason = savedData.absenceReason;
    if (previousReason !== data.absenceReason) {
      saveFormData({ ...data, symptoms: [], otherSymptomText: '' });
    } else {
      saveFormData(data);
    }
    router.push('/symptoms');
  };

  const title = firstName
    ? `What's the reason for your absence, ${firstName}?`
    : 'What is your reason for absence?';

  return (
    <FormLayout
      currentStep={CURRENT_STEP}
      title={title}
      description=""
      usePersonalization={true}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormRadioGroup
          fieldName="absenceReason"
          legend="What is your reason for absence?"
          options={absenceReasonOptions.map(r => ({ value: r, label: r }))}
          register={register('absenceReason')}
          error={errors.absenceReason}
          selectedValue={selectedReason}
          gridClassName="grid gap-3 sm:grid-cols-2"
        />

        <FormNavigation
          backRoute="/absence-dates"
          isSubmitting={isSubmitting}
        />
      </form>
    </FormLayout>
  );
}
