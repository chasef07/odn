"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, subDays, differenceInDays } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FormLayout } from '@/components/form-layout';
import { FormEditableSection } from '@/components/form/FormEditableSection';
import { FormField } from '@/components/form/FormField';
import { FormNavigation } from '@/components/form/FormNavigation';
import { getFormData, saveFormData } from '@/lib/form-storage';
import { page2Schema, page3Schema, page6Schema, page9Schema } from '@/lib/validation-schemas';

const CURRENT_STEP = 9;

// Format phone number as (555) 123-4567
const formatPhoneNumber = (value: string) => {
  // Remove all non-digits
  const phoneNumber = value.replace(/\D/g, '');

  // Apply formatting
  if (phoneNumber.length <= 3) {
    return phoneNumber;
  } else if (phoneNumber.length <= 6) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  } else {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  }
};

type EditSection = 'personal' | 'contact' | 'dates' | null;

type TermsFormData = {
  certifyAccurate: boolean;
  agreeTerms: boolean;
};

type PersonalFormData = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
};

type ContactFormData = {
  email: string;
  phone: string;
};

type DatesFormData = {
  firstDayOff: string;
  lastDayOff: string;
};

export default function ReviewPage() {
  const router = useRouter();
  const [formData, setFormData] = useState(getFormData());
  const [editingSection, setEditingSection] = useState<EditSection>(null);
  const [phoneDisplay, setPhoneDisplay] = useState(formData.phone || '');

  // Main form for terms checkboxes
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TermsFormData>({
    resolver: zodResolver(page9Schema),
    defaultValues: {
      certifyAccurate: false,
      agreeTerms: false
    }
  });

  // Personal info edit form
  const personalForm = useForm<PersonalFormData>({
    resolver: zodResolver(page2Schema),
    defaultValues: {
      firstName: formData.firstName || '',
      lastName: formData.lastName || '',
      dateOfBirth: formData.dateOfBirth || ''
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
      lastDayOff: formData.lastDayOff || ''
    }
  });

  // Handler to start editing a section
  const handleEdit = (section: EditSection) => {
    // Reset phone display to current saved value when entering edit mode
    if (section === 'contact') {
      setPhoneDisplay(formData.phone || '');
    }
    setEditingSection(section);
  };

  // Handler to cancel editing
  const handleCancel = (section: EditSection) => {
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
    // Additional validation
    const now = new Date();
    const minStartDate = subDays(now, 7);
    const startDate = new Date(data.firstDayOff);
    const endDate = new Date(data.lastDayOff);

    if (startDate < minStartDate) {
      datesForm.setError('firstDayOff', {
        message: 'Start date cannot be more than 7 days in the past'
      });
      return;
    }

    if (endDate < startDate) {
      datesForm.setError('lastDayOff', {
        message: 'End date must be after start date'
      });
      return;
    }

    const daysDiff = differenceInDays(endDate, startDate);
    if (daysDiff > 7) {
      datesForm.setError('lastDayOff', {
        message: 'Date range cannot exceed 7 days'
      });
      return;
    }

    saveFormData(data);
    setFormData(getFormData());
    setEditingSection(null);
  });

  // Main form submission
  const onSubmit = () => {
    router.push('/payment');
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
      currentStep={CURRENT_STEP}
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
                {formData.firstName} {formData.lastName}
              </p>
              <p className="text-sm text-muted-foreground">
                Date of Birth: {formatDate(formData.dateOfBirth)}
              </p>
            </>
          }
          editContent={
            <>
              <FormField
                id="firstName"
                label="First Name"
                register={personalForm.register('firstName')}
                error={personalForm.formState.errors.firstName}
              />
              <FormField
                id="lastName"
                label="Last Name"
                register={personalForm.register('lastName')}
                error={personalForm.formState.errors.lastName}
              />
              <FormField
                id="dateOfBirth"
                label="Date of Birth"
                type="date"
                register={personalForm.register('dateOfBirth')}
                error={personalForm.formState.errors.dateOfBirth}
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
            <p className="text-base text-foreground">
              {formatDate(formData.firstDayOff)} -{' '}
              {formatDate(formData.lastDayOff)}
            </p>
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
              className="mt-1 h-5 w-5 rounded border-2 border-border/60 checked:bg-primary checked:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
            />
            <Label
              htmlFor="certifyAccurate"
              className="text-sm font-normal text-foreground cursor-pointer leading-relaxed"
            >
              I certify that all information provided is accurate and truthful to
              the best of my knowledge.
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
              className="mt-1 h-5 w-5 rounded border-2 border-border/60 checked:bg-primary checked:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
            />
            <Label
              htmlFor="agreeTerms"
              className="text-sm font-normal text-foreground cursor-pointer leading-relaxed"
            >
              I agree to the{' '}
              <a href="/terms" className="text-primary hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </a>
              .
            </Label>
          </div>
          {errors.agreeTerms && (
            <p className="text-sm text-red-500">{errors.agreeTerms.message}</p>
          )}
        </div>

        <FormNavigation
          backRoute="/symptoms"
          submitText="Continue to Payment"
          isSubmitting={isSubmitting}
        />
      </form>
    </FormLayout>
  );
}
