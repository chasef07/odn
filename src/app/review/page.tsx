"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FormLayout } from '@/components/form-layout';
import { FormEditableSection } from '@/components/form/FormEditableSection';
import { FormField } from '@/components/form/FormField';
import { FormNavigation } from '@/components/form/FormNavigation';
import { getFormData, saveFormData } from '@/lib/form-storage';
import { page2Schema, page3Schema, page6Schema, page10Schema } from '@/lib/validation-schemas';
import { formatPhoneNumber } from '@/lib/phone-utils';
import { validateAbsenceDates } from '@/lib/date-validators';
import { UI_TIMING } from '@/lib/validation-constants';

// Step number will be dynamic based on recipient

type EditSection = 'personal' | 'contact' | 'dates' | null;

type TermsFormData = {
  certifyAccurate: boolean;
  agreeTerms: boolean;
};

type PersonalFormData = {
  patientFirstName: string;
  patientLastName: string;
  patientDateOfBirth: string;
};

type ContactFormData = {
  email: string;
  phone: string;
};

type DatesFormData = {
  firstDayOff: string;
  lastDayOff: string;
  returnDate?: string;
};

export default function ReviewPage() {
  const router = useRouter();
  const [formData, setFormData] = useState(getFormData());
  const recipient = formData.recipient || 'myself';
  const currentStep = recipient === 'someone_else' ? 11 : 10;
  const [editingSection, setEditingSection] = useState<EditSection>(null);
  const [phoneDisplay, setPhoneDisplay] = useState(formData.phone || '');
  const [isProcessing, setIsProcessing] = useState(false);

  // Main form for terms checkboxes
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TermsFormData>({
    resolver: zodResolver(page10Schema),
    defaultValues: {
      certifyAccurate: false,
      agreeTerms: false
    }
  });

  // Personal info edit form
  const personalForm = useForm<PersonalFormData>({
    resolver: zodResolver(page2Schema),
    defaultValues: {
      patientFirstName: formData.patientFirstName || '',
      patientLastName: formData.patientLastName || '',
      patientDateOfBirth: formData.patientDateOfBirth || ''
    }
  });

  // Contact info edit form
  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(page3Schema),
    defaultValues: {
      email: formData.email || '',
      phone: formData.phone || ''
    }
  });

  // Absence dates edit form
  const datesForm = useForm<DatesFormData>({
    resolver: zodResolver(page6Schema),
    defaultValues: {
      firstDayOff: formData.firstDayOff || '',
      lastDayOff: formData.lastDayOff || '',
      returnDate: formData.returnDate || ''
    }
  });

  const notePurpose = formData.notePurpose || '';
  const shouldShowReturnDate = notePurpose === 'work' || notePurpose === 'school' || notePurpose === 'both';

  // Handler to start editing a section
  const handleEdit = (section: string) => {
    // Reset phone display to current saved value when entering edit mode
    if (section === 'contact') {
      setPhoneDisplay(formData.phone || '');
    }
    setEditingSection(section as EditSection);
  };

  // Handler to cancel editing
  const handleCancel = (section: string) => {
    if (section === 'personal') {
      personalForm.reset();
    } else if (section === 'contact') {
      contactForm.reset();
      // Reset phone display to saved value
      setPhoneDisplay(formData.phone || '');
    } else if (section === 'dates') {
      datesForm.reset();
    }
    setEditingSection(null);
  };

  // Handler to save personal info
  const handleSavePersonal = personalForm.handleSubmit((data) => {
    saveFormData(data);
    setFormData(getFormData());
    setEditingSection(null);
  });

  // Handler for phone number change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneDisplay(formatted);
    contactForm.setValue('phone', formatted);
  };

  // Handler to save contact info
  const handleSaveContact = contactForm.handleSubmit((data) => {
    saveFormData(data);
    setFormData(getFormData());
    setPhoneDisplay(data.phone);
    setEditingSection(null);
  });

  // Handler to save absence dates
  const handleSaveDates = datesForm.handleSubmit((data) => {
    // Use centralized validation
    const validationData = {
      firstDayOff: data.firstDayOff,
      lastDayOff: data.lastDayOff,
      needReturnDate: shouldShowReturnDate,
      returnDate: data.returnDate
    };

    const validationErrors = validateAbsenceDates(validationData);

    if (validationErrors.length > 0) {
      // Set errors on form
      validationErrors.forEach(error => {
        datesForm.setError(error.field as keyof DatesFormData, {
          message: error.message
        });
      });
      return;
    }

    // Validate return date if it should be shown
    if (shouldShowReturnDate && !data.returnDate) {
      datesForm.setError('returnDate', {
        message: 'Please select return date'
      });
      return;
    }

    saveFormData(data);
    setFormData(getFormData());
    setEditingSection(null);
  });

  // Main form submission
  const onSubmit = () => {
    setIsProcessing(true);

    // Simulate processing delay to show loading state
    setTimeout(() => {
      router.push('/approved');
    }, UI_TIMING.PROCESSING_DELAY_MS);
  };

  // Helper function to format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not provided';
    try {
      return format(new Date(dateString), 'MMMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <FormLayout
      currentStep={currentStep}
      title="Review your information"
      description="Please review all details carefully before continuing to payment."
      usePersonalization={true}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Information */}
        <FormEditableSection
          sectionId="personal"
          title="Personal Information"
          editingSection={editingSection}
          onEdit={handleEdit}
          onCancel={handleCancel}
          onSave={handleSavePersonal}
          viewContent={
            <>
              <p className="text-base text-foreground">
                {formData.patientFirstName} {formData.patientLastName}
              </p>
              <p className="text-sm text-muted-foreground">
                Date of Birth: {formatDate(formData.patientDateOfBirth)}
              </p>
            </>
          }
          editContent={
            <>
              <FormField
                id="patientFirstName"
                label="First Name"
                register={personalForm.register('patientFirstName')}
                error={personalForm.formState.errors.patientFirstName}
              />
              <FormField
                id="patientLastName"
                label="Last Name"
                register={personalForm.register('patientLastName')}
                error={personalForm.formState.errors.patientLastName}
              />
              <FormField
                id="patientDateOfBirth"
                label="Date of Birth"
                type="date"
                register={personalForm.register('patientDateOfBirth')}
                error={personalForm.formState.errors.patientDateOfBirth}
              />
            </>
          }
        />

        {/* Contact Information */}
        <FormEditableSection
          sectionId="contact"
          title="Contact Information"
          editingSection={editingSection}
          onEdit={handleEdit}
          onCancel={handleCancel}
          onSave={handleSaveContact}
          viewContent={
            <>
              <p className="text-base text-foreground">{formData.email}</p>
              <p className="text-sm text-muted-foreground">{formData.phone}</p>
            </>
          }
          editContent={
            <>
              <FormField
                id="email"
                label="Email Address"
                type="email"
                register={contactForm.register('email')}
                error={contactForm.formState.errors.email}
                placeholder="your.email@example.com"
              />

              {/* Phone - Custom formatting */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phoneDisplay}
                  onChange={handlePhoneChange}
                  className="h-12 rounded-xl border border-border/60 bg-white text-base focus-visible:ring-2 focus-visible:ring-primary/40"
                  placeholder="(555) 123-4567"
                  maxLength={14}
                  aria-required="true"
                  aria-invalid={!!contactForm.formState.errors.phone}
                  aria-describedby={contactForm.formState.errors.phone ? "phone-error" : undefined}
                />
                {contactForm.formState.errors.phone && (
                  <p id="phone-error" className="text-sm text-red-500">
                    {contactForm.formState.errors.phone.message}
                  </p>
                )}
              </div>
            </>
          }
        />

        {/* Absence Dates */}
        <FormEditableSection
          sectionId="dates"
          title="Absence Dates"
          editingSection={editingSection}
          onEdit={handleEdit}
          onCancel={handleCancel}
          onSave={handleSaveDates}
          viewContent={
            <>
              <p className="text-base text-foreground">
                {formatDate(formData.firstDayOff)} -{' '}
                {formatDate(formData.lastDayOff)}
              </p>
              {shouldShowReturnDate && formData.returnDate && (
                <p className="text-sm text-muted-foreground mt-1">
                  Return Date: {formatDate(formData.returnDate)}
                </p>
              )}
            </>
          }
          editContent={
            <>
              <FormField
                id="firstDayOff"
                label="First Day Off"
                type="date"
                register={datesForm.register('firstDayOff')}
                error={datesForm.formState.errors.firstDayOff}
              />
              <FormField
                id="lastDayOff"
                label="Last Day Off"
                type="date"
                register={datesForm.register('lastDayOff')}
                error={datesForm.formState.errors.lastDayOff}
              />
              {shouldShowReturnDate && (
                <FormField
                  id="returnDate"
                  label="Return to Work/School Date"
                  type="date"
                  register={datesForm.register('returnDate')}
                  error={datesForm.formState.errors.returnDate}
                />
              )}
            </>
          }
        />

        {/* Terms Checkboxes - Native Checkboxes */}
        <div className="space-y-4 rounded-xl border border-border/40 bg-white p-6 shadow-sm">
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="certifyAccurate"
              {...register('certifyAccurate')}
              className="mt-1 h-5 w-5 flex-shrink-0 rounded border-2 border-border/60 checked:bg-primary checked:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
            />
            <Label
              htmlFor="certifyAccurate"
              className="text-sm font-normal text-foreground cursor-pointer leading-relaxed flex-1"
            >
              I certify that all information provided is accurate and truthful to the best of my knowledge.
            </Label>
          </div>
          {errors.certifyAccurate && (
            <p className="text-sm text-red-500">{errors.certifyAccurate.message}</p>
          )}

          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="agreeTerms"
              {...register('agreeTerms')}
              className="mt-1 h-5 w-5 flex-shrink-0 rounded border-2 border-border/60 checked:bg-primary checked:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
            />
            <Label
              htmlFor="agreeTerms"
              className="text-sm font-normal text-foreground cursor-pointer leading-relaxed flex-1"
            >
              I agree to the Terms of Service and Privacy Policy.
            </Label>
          </div>
          {errors.agreeTerms && (
            <p className="text-sm text-red-500">{errors.agreeTerms.message}</p>
          )}
        </div>

        <FormNavigation
          backRoute="/additional-info"
          submitText="Continue to Payment"
          isSubmitting={isSubmitting}
        />
      </form>

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            {/* Spinner */}
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>

            {/* Loading text */}
            <p className="text-lg font-medium text-foreground">
              Processing your request...
            </p>
          </div>
        </div>
      )}
    </FormLayout>
  );
}
