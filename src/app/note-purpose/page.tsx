"use client";

import { useRouter } from "next/navigation";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormLayout } from "@/components/form-layout";
import { FormRadioGroup } from '@/components/form/FormRadioGroup';
import { FormNavigation } from '@/components/form/FormNavigation';
import { saveFormData, getFormData } from "@/lib/form-storage";
import { page5Schema } from '@/lib/validation-schemas';
import { NOTE_PURPOSES } from "@/lib/form-constants";

const CURRENT_STEP = 5;

const NOTE_PURPOSE_OPTIONS = [
  {
    value: "work" as const,
    label: NOTE_PURPOSES.work.label,
  },
  {
    value: "school" as const,
    label: NOTE_PURPOSES.school.label,
  },
  {
    value: "both" as const,
    label: NOTE_PURPOSES.both.label,
  },
  {
    value: "other" as const,
    label: NOTE_PURPOSES.other.label,
  },
];

type FormData = {
  notePurpose: 'work' | 'school' | 'both' | 'other';
};

export default function NotePurposePage() {
  const router = useRouter();
  const savedData = getFormData();
  const firstName = savedData.firstName || '';

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(page5Schema),
    defaultValues: getFormData()
  });

  const selectedPurpose = watch('notePurpose');

  const onSubmit = (data: FormData) => {
    saveFormData(data);
    router.push('/absence-dates');
  };

  const title = firstName
    ? `Got it, ${firstName}! What do you need this note for?`
    : 'What do you need this note for?';

  return (
    <FormLayout
      currentStep={CURRENT_STEP}
      title={title}
      description=""
      usePersonalization={true}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormRadioGroup
          fieldName="notePurpose"
          legend="What do you need this note for?"
          options={NOTE_PURPOSE_OPTIONS}
          register={register('notePurpose')}
          error={errors.notePurpose}
          selectedValue={selectedPurpose}
          variant="large-buttons"
        />

        <FormNavigation
          backRoute="/state"
          isSubmitting={isSubmitting}
        />
      </form>
    </FormLayout>
  );
}
