"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProgress } from '@/components/form-progress';
import { FormRadioGroup } from '@/components/form/FormRadioGroup';
import { FormNavigation } from '@/components/form/FormNavigation';
import { saveFormData, getFormData } from '@/lib/form-storage';
import { page1Schema } from '@/lib/validation-schemas';
import { ShieldCheck, Clock, Star } from 'lucide-react';

const CURRENT_STEP = 2;

type FormData = {
  recipient: 'myself' | 'someone_else' | null;
};

export default function WhoIsUsingPage() {
  const router = useRouter();

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(page1Schema),
    defaultValues: getFormData()
  });

  const recipient = watch('recipient');

  const onSubmit = (data: FormData) => {
    saveFormData(data);
    router.push('/basic-info');
  };

  return (
    <div className="min-h-screen bg-white text-foreground">
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        {/* Top Bar: Progress + Trust Badges */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <FormProgress currentStep={CURRENT_STEP} />
          </div>

          {/* Horizontal Trust Badges */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground sm:gap-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>~2 min</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Money back guarantee</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground mb-4">
            Who is this note for?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            If you are under the age of 18 please have your parent or guardian complete the form.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormRadioGroup
            fieldName="recipient"
            legend="Who is using this note?"
            options={[
              { value: 'myself', label: 'Myself' },
              { value: 'someone_else', label: 'Someone else' }
            ]}
            register={register('recipient')}
            error={errors.recipient}
            selectedValue={recipient ?? undefined}
            variant="center-buttons"
            gridClassName="flex flex-wrap gap-4 justify-center"
          />

          <FormNavigation
            backRoute="/get-started"
            isSubmitting={isSubmitting}
          />
        </form>
      </main>
    </div>
  );
}
