"use client";

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormProgress } from '@/components/form-progress';
import { FormCard } from '@/components/form/FormCard';
import { FormSelect } from '@/components/form/FormSelect';
import { FormNavigation } from '@/components/form/FormNavigation';
import { saveFormData, getFormData } from '@/lib/form-storage';
import { page4Schema } from '@/lib/validation-schemas';
import { AVAILABLE_STATES } from '@/lib/form-constants';
import { ShieldCheck, Clock, Star } from 'lucide-react';

const CURRENT_STEP = 1;

type FormData = {
  state: string;
};

export default function Home() {
  const router = useRouter();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(page4Schema),
    defaultValues: {
      state: getFormData().state || ''
    }
  });

  const onSubmit = (data: FormData) => {
    saveFormData(data);
    router.push('/who-is-using');
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
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>~2 min</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">Money back guarantee</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground mb-4">
            Where are you located?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select your state to ensure we can serve you.
          </p>
        </div>

        {/* Form */}
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
              Join 12,000+ people who got their note in minutes
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
