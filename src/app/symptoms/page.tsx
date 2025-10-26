"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FormLayout } from '@/components/form-layout';
import { FormCard } from '@/components/form/FormCard';
import { FormCheckboxGroup } from '@/components/form/FormCheckboxGroup';
import { FormNavigation } from '@/components/form/FormNavigation';
import { saveFormData, getFormData } from '@/lib/form-storage';
import { page8Schema } from '@/lib/validation-schemas';
import { SYMPTOMS_BY_REASON } from '@/lib/form-constants';

const CURRENT_STEP = 8;

type FormData = {
  symptoms: string[];
  otherSymptomText?: string;
};

export default function SymptomsPage() {
  const router = useRouter();
  const savedData = getFormData();
  const absenceReason = savedData.absenceReason || '';

  const { register, handleSubmit, watch, formState: { errors, isSubmitting }, setError } = useForm<FormData>({
    resolver: zodResolver(page8Schema),
    defaultValues: {
      symptoms: savedData.symptoms || [],
      otherSymptomText: savedData.otherSymptomText || ''
    }
  });

  const symptoms = watch('symptoms') || [];

  // Get available symptoms based on absence reason
  const availableSymptoms = absenceReason === 'Other'
    ? []
    : (SYMPTOMS_BY_REASON[absenceReason] || []);

  const onSubmit = (data: FormData) => {
    // Additional validation for "Other" reason
    if (absenceReason === 'Other') {
      if (!data.otherSymptomText?.trim()) {
        setError('otherSymptomText', {
          message: 'Please describe your symptoms'
        });
        return;
      }
    } else {
      if (!data.symptoms || data.symptoms.length === 0) {
        setError('symptoms', {
          message: 'Please select at least one symptom'
        });
        return;
      }
    }

    saveFormData(data);
    router.push('/review');
  };

  return (
    <FormLayout
      currentStep={CURRENT_STEP}
      title="What symptoms are you experiencing?"
      description="Select all symptoms that apply."
      usePersonalization={true}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8">
        {/* For "Other" absence reason, show only text field */}
        {absenceReason === 'Other' ? (
          <FormCard spacing="space-y-3">
            <Label htmlFor="otherSymptomText" className="text-sm font-medium">
              Describe your symptoms
            </Label>
            <Textarea
              id="otherSymptomText"
              {...register('otherSymptomText')}
              className="min-h-[120px] resize-none rounded-xl border-border/60 text-base focus-visible:ring-2 focus-visible:ring-primary/40"
              placeholder="Please describe your symptoms in detail..."
              aria-required="true"
              aria-invalid={!!errors.otherSymptomText}
              aria-describedby={errors.otherSymptomText ? "otherSymptomText-error" : undefined}
            />
            {errors.otherSymptomText && (
              <p id="otherSymptomText-error" className="text-sm text-red-500">{errors.otherSymptomText.message}</p>
            )}
          </FormCard>
        ) : (
          /* For specific reasons, show symptom checkboxes */
          <FormCheckboxGroup
            fieldName="symptoms"
            legend="Select all symptoms that apply"
            options={availableSymptoms.map(s => ({ value: s, label: s }))}
            register={register('symptoms')}
            error={errors.symptoms}
            selectedValues={symptoms}
          />
        )}

        <FormNavigation
          backRoute="/absence-reason"
          isSubmitting={isSubmitting}
        />
      </form>
    </FormLayout>
  );
}
