import { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { FormProgress } from './form-progress'
import { getFirstName } from '@/lib/form-storage'

interface FormLayoutProps {
  currentStep: number
  title: string
  description: string
  children: ReactNode
  usePersonalization?: boolean
  hideProgressAndBadges?: boolean
}

export function FormLayout({
  currentStep,
  title,
  description,
  children,
  usePersonalization = false,
  hideProgressAndBadges = false,
}: FormLayoutProps) {
  const firstName = usePersonalization ? getFirstName() : null

  // Replace {firstName} placeholder with actual name
  const personalizedTitle = firstName
    ? title.replace('{firstName}', firstName)
    : title.replace('{firstName}', '')

  return (
    <div className="text-foreground min-h-screen bg-white">
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        {/* Top Bar: Progress + Trust Badges */}
        {!hideProgressAndBadges && (
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <FormProgress currentStep={currentStep} />
            </div>

            {/* Horizontal Trust Badges */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs sm:gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-primary h-4 w-4" />
                <span>HIPAA Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-primary h-4 w-4" />
                <span>Money back guarantee</span>
              </div>
            </div>
          </div>
        )}

        {/* Title - Centered on White Background */}
        <div className="mb-4 text-center">
          <h1 className="font-display text-foreground mb-4 text-4xl font-bold sm:text-5xl">
            {personalizedTitle}
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">{description}</p>
        </div>

        {/* Form Content */}
        {children}
      </main>
    </div>
  )
}
