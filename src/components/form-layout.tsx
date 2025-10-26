import { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { FormProgress } from './form-progress';
import { getFirstName } from '@/lib/form-storage';

interface FormLayoutProps {
  currentStep: number;
  title: string;
  description: string;
  children: ReactNode;
  usePersonalization?: boolean;
  hideProgressAndBadges?: boolean;
}

export function FormLayout({
  currentStep,
  title,
  description,
  children,
  usePersonalization = false,
  hideProgressAndBadges = false,
}: FormLayoutProps) {
  const firstName = usePersonalization ? getFirstName() : null;

  // Replace {firstName} placeholder with actual name
  const personalizedTitle = firstName
    ? title.replace('{firstName}', firstName)
    : title.replace('{firstName}', '');

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
        {!hideProgressAndBadges && (
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <FormProgress currentStep={currentStep} />
            </div>

            {/* Horizontal Trust Badges */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground sm:gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="font-medium text-primary">Money-back</span>
              </div>
            </div>
          </div>
        )}

        {/* Title - Centered on White Background */}
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground mb-4">
            {personalizedTitle}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {description}
          </p>
        </div>

        {/* Form Content */}
        {children}
      </main>
    </div>
  );
}
