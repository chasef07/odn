"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProgress } from '@/components/form-progress';
import { FormCard } from '@/components/form/FormCard';
import { FormRadioGroup } from '@/components/form/FormRadioGroup';
import { FormSelect } from '@/components/form/FormSelect';
import { FormNavigation } from '@/components/form/FormNavigation';
import { saveFormData, getFormData } from '@/lib/form-storage';
import { page1Schema } from '@/lib/validation-schemas';
import { RELATIONSHIPS } from '@/lib/form-constants';
import { ShieldCheck, Clock, Star } from 'lucide-react';

const CURRENT_STEP = 1;

type FormData = {
  recipient: 'myself' | 'someone_else';
  relationship?: string;
};

export default function Home() {
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
      {/* Top-Right Logo Badge */}
      <div className="fixed top-6 right-6 z-10">
        <div className="rounded-full bg-white/80 backdrop-blur-sm border border-primary/10 px-4 py-2 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
            onlinedoctornote
          </span>
        </div>
      </div>

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
              <span>Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>~2 min</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">Money-back</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground mb-4">
            Who is this note for?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Let us know if you need a doctor&apos;s note for yourself or
            someone you&apos;re caring for.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormRadioGroup
            fieldName="recipient"
            legend="Who is this note for?"
            options={[
              { value: 'myself', label: 'Myself' },
              { value: 'someone_else', label: 'Someone else' }
            ]}
            register={register('recipient')}
            error={errors.recipient}
            selectedValue={recipient}
            variant="center-buttons"
            gridClassName="flex flex-wrap gap-4 justify-center"
          />

          {/* Conditional Relationship Dropdown */}
          {recipient === 'someone_else' && (
            <FormCard spacing="space-y-3">
              <FormSelect
                id="relationship"
                label="What is your relationship to this person?"
                options={RELATIONSHIPS}
                placeholder="Select relationship"
                register={register('relationship')}
                error={errors.relationship}
                height="h-14"
              />
            </FormCard>
          )}

          <FormNavigation
            backRoute="/"
            isSubmitting={isSubmitting}
          />

          {/* Social Proof - Bottom of Form */}
          <div className="pt-10 text-center space-y-3">
            <div className="flex items-center justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="h-4 w-4 fill-yellow-400 text-yellow-400"
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Join 50,000+ people who got their note in minutes
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
