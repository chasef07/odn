'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  Shield,
  Star,
  DollarSign,
  BadgeCheck,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card } from '@/components/ui/card'
import { CTAButton } from '@/components/ui/cta-button'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="px-6 py-20 lg:flex lg:items-center">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            {/* Right Column - Hero Image (appears first on mobile) */}
            <div className="relative order-1 lg:order-2">
              <Image
                src="/images/homepage/hero.jpg"
                alt="Doctor reviewing patient medical note"
                width={1376}
                height={1130}
                priority
                quality={90}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="rounded-lg shadow-xl"
              />
            </div>

            {/* Left Column - Text Content (appears second on mobile) */}
            <div className="order-2 text-center lg:order-1 lg:text-left">
              <h1 className="font-display text-foreground mb-6 text-5xl font-bold leading-tight sm:text-6xl">
                The <span className="text-primary">convenient</span> way to get a doctor&apos;s note for work or school!
              </h1>

              {/* Primary CTA */}
              <CTAButton className="mb-4" />

              <p className="mb-8 text-base">
                <span className="text-primary text-2xl font-bold">$24.95</span>
                <span className="text-muted-foreground"> • Money-Back Guarantee</span>
              </p>

              {/* Trust Badges */}
              <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-6 text-base lg:justify-start">
                <div className="flex items-center gap-2">
                  <Shield className="text-primary h-5 w-5" />
                  <span>HIPAA Compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="text-primary h-5 w-5" />
                  <span>17,000+ Notes Issued</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-primary h-5 w-5" />
                  <span>U.S. Licensed Doctors</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-blue-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-4xl font-bold">How it Works</h2>

          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {/* Step 1 */}
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <div className="bg-primary mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white">
                1
              </div>
              <h3 className="mb-2 text-center text-xl font-bold">Complete the Online Form</h3>
              <p className="text-muted-foreground text-center">
                It only takes a few minutes.
              </p>
            </div>

            {/* Arrow */}
            <ArrowRight className="text-primary mx-auto hidden h-8 w-8 md:block" />

            {/* Step 2 */}
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <div className="bg-primary mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white">
                2
              </div>
              <h3 className="mb-2 text-center text-xl font-bold">Get Doctor Approval</h3>
              <p className="text-muted-foreground text-center">
                A board-certified doctor will sign your note.
              </p>
            </div>

            {/* Arrow */}
            <ArrowRight className="text-primary mx-auto hidden h-8 w-8 md:block" />

            {/* Step 3 */}
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <div className="bg-primary mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white">
                3
              </div>
              <h3 className="mb-2 text-center text-xl font-bold">Get Your Note</h3>
              <p className="text-muted-foreground text-center">Delivered by email in minutes.</p>
            </div>
          </div>

          {/* CTA Below Boxes */}
          <div className="mt-12 text-center">
            <CTAButton />
          </div>
        </div>
      </section>

      {/* What's Included Section */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-4 text-center text-5xl font-bold">What&apos;s Included</h2>
          <p className="text-primary mb-16 text-center text-2xl font-semibold">
            It&apos;s way more than just a note!
          </p>

          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            {/* Left Column - Doctor Note Image */}
            <div className="flex justify-center">
              <Image
                src="/images/homepage/Doctor-Note-letter-1024px.png"
                alt="Sample doctor's note document"
                width={1024}
                height={936}
                quality={85}
                sizes="(max-width: 1024px) 100vw, 576px"
                className="w-full max-w-xl"
              />
            </div>

            {/* Right Column - Features */}
            <div className="space-y-8">
              {/* 100% Money Back Guarantee */}
              <div className="flex items-center gap-5">
                <DollarSign className="text-primary h-12 w-12 shrink-0" />
                <h3 className="text-2xl font-semibold">100% Money Back Guarantee</h3>
              </div>

              {/* Employer/School Verification */}
              <div className="flex items-center gap-5">
                <Phone className="text-primary h-12 w-12 shrink-0" />
                <h3 className="text-2xl font-semibold">Employer / School Verification Service</h3>
              </div>

              {/* Board-Certified Doctors */}
              <div className="flex items-center gap-5">
                <BadgeCheck className="text-primary h-12 w-12 shrink-0" />
                <h3 className="text-2xl font-semibold">Board-Certified Doctors</h3>
              </div>

              {/* HIPAA Compliant */}
              <div className="flex items-center gap-5">
                <Shield className="text-primary h-12 w-12 shrink-0" />
                <h3 className="text-2xl font-semibold">HIPAA Compliant</h3>
              </div>

              {/* Valid Nationwide */}
              <div className="flex items-center gap-5">
                <MapPin className="text-primary h-12 w-12 shrink-0" />
                <h3 className="text-2xl font-semibold">Valid Nationwide</h3>
              </div>

              {/* CTA Button */}
              <div className="pt-6">
                <CTAButton />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Patients Love Us Section */}
      <section className="bg-blue-50 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-16 text-center text-5xl font-bold">Why Patients Love Us</h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Testimonial 1 */}
            <figure className="rounded-2xl bg-white p-8 shadow-sm">
              {/* 5 Stars */}
              <div className="mb-6 flex gap-1" aria-label="5 out of 5 stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 fill-primary text-primary" aria-hidden="true" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="mb-6 text-lg leading-relaxed text-gray-800">
                I got my letter within 15 minutes! What a great service.
              </blockquote>

              {/* Author */}
              <figcaption className="font-semibold text-gray-600">J. S</figcaption>
            </figure>

            {/* Testimonial 2 */}
            <figure className="rounded-2xl bg-white p-8 shadow-sm">
              {/* 5 Stars */}
              <div className="mb-6 flex gap-1" aria-label="5 out of 5 stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 fill-primary text-primary" aria-hidden="true" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="mb-6 text-lg leading-relaxed text-gray-800">
                That was way easier than going to the doctor&apos;s office in person.
              </blockquote>

              {/* Author */}
              <figcaption className="font-semibold text-gray-600">D. R.</figcaption>
            </figure>

            {/* Testimonial 3 */}
            <figure className="rounded-2xl bg-white p-8 shadow-sm">
              {/* 5 Stars */}
              <div className="mb-6 flex gap-1" aria-label="5 out of 5 stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 fill-primary text-primary" aria-hidden="true" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="mb-6 text-lg leading-relaxed text-gray-800">
                My work called to verify the letter and there was no issue. That was easy!
              </blockquote>

              {/* Author */}
              <figcaption className="font-semibold text-gray-600">C. H.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-4xl font-bold">Frequently Asked Questions</h2>

          <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full space-y-4">
              <AccordionItem value="item-1" className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline px-6 py-4">
                  What is a doctor&apos;s note?
                </AccordionTrigger>
                <AccordionContent className="text-base text-foreground/75 leading-relaxed px-6 pb-6 pt-1">
                  A doctor&apos;s note is a written document provided by a healthcare professional that confirms your evaluation and health condition and excuses you from work and / or school. It typically includes basic information about you and the dates of absence. For privacy purposes, it should not include detailed information about your health condition.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline px-6 py-4">
                  Who is eligible for a doctor&apos;s note?
                </AccordionTrigger>
                <AccordionContent className="text-base text-foreground/75 leading-relaxed px-6 pb-6 pt-1">
                  Employees, students, parents or guardians, and caregivers. If you are under the age of 18, please have your parent or guardian complete the online form.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline px-6 py-4">
                  Will my employer or school accept the note?
                </AccordionTrigger>
                <AccordionContent className="text-base text-foreground/75 leading-relaxed px-6 pb-6 pt-1">
                  We have a 100% money-back guarantee, so you never have to worry. Our doctor&apos;s notes are signed by a board-certified doctor in your state and contain all of the required information to be compliant while maintaining your privacy. If you have any issue, please contact us and our office staff will gladly assist with verification for your employer or school.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline px-6 py-4">
                  How quickly can I get my doctor&apos;s note?
                </AccordionTrigger>
                <AccordionContent className="text-base text-foreground/75 leading-relaxed px-6 pb-6 pt-1">
                  Our normal business hours are 8am to 12am EST. During that time, our doctors will usually issue a note within 30 minutes or less of reviewing your health forms, and our office will send a digital copy to your email. During off hours, it may take a little longer to get your note, but we will always try our best to be as quick as possible.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline px-6 py-4">
                  Can I use my health insurance?
                </AccordionTrigger>
                <AccordionContent className="text-base text-foreground/75 leading-relaxed px-6 pb-6 pt-1">
                  Currently we do not accept insurance. However, we do our best to make our services very affordable and the cost of $24.95 is usually less than your co-pay. Even better, a quick online note saves you a trip to the doctor&apos;s office.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline px-6 py-4">
                  What can your doctor&apos;s note be used for?
                </AccordionTrigger>
                <AccordionContent className="text-base text-foreground/75 leading-relaxed px-6 pb-6 pt-1">
                  Your note from us can be used for simple work or school absences of 5 days or less. Generally this covers mild acute illnesses, minor injuries, mental health issues, doctor&apos;s appointments, and caregiver duties.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline px-6 py-4">
                  What your doctor&apos;s note cannot be used for?
                </AccordionTrigger>
                <AccordionContent className="text-base text-foreground/75 leading-relaxed px-6 pb-6 pt-1">
                  At this time, we cannot provide notes for FMLA (Family and Medical Leave Act) purposes, absences for legal reasons such as a court appearance, insurance forms, return-to-work clearance, disability or workplace accommodations, and emotional support animal letters.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8" className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline px-6 py-4">
                  What can happen if you forge a doctor&apos;s note?
                </AccordionTrigger>
                <AccordionContent className="text-base text-foreground/75 leading-relaxed px-6 pb-6 pt-1">
                  Forging a doctor&apos;s note can have serious legal and professional consequences. You can face disciplinary action at work or school. It is always best to obtain legitimate documentation from a licensed healthcare provider rather than attempting to create a fraudulent document.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-4xl font-bold">Ready to Get Your Doctor&apos;s Note?</h2>
          <p className="text-muted-foreground mb-8 text-xl">Join 17,000+ satisfied patients</p>

          <CTAButton showPrice />
        </div>
      </section>

      <Footer />

      {/* Structured Data - FAQ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'How long does it take to get my note?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Most notes are delivered within 2-4 hours. Our board-certified physicians review requests promptly to ensure you receive your note as quickly as possible.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is this legal?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes, completely legal. Our notes are signed by licensed, board-certified physicians who review each case individually. These are legitimate medical documents.',
                },
              },
              {
                '@type': 'Question',
                name: 'What can I use this note for?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Our notes can be used for work absences, school absences, and similar short-term needs. They cannot be used for FMLA, workers\' compensation, legal issues, or disability claims.',
                },
              },
              {
                '@type': 'Question',
                name: 'What if my employer or school doesn\'t accept it?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'We offer a 100% money-back guarantee. If your note is not accepted, we\'ll issue a full refund. Our notes are accepted by the vast majority of employers and schools nationwide.',
                },
              },
              {
                '@type': 'Question',
                name: 'What information do I need to provide?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'You\'ll need basic personal information, the reason for your absence, dates you need covered, and contact information. The entire process takes less than 2 minutes to complete.',
                },
              },
              {
                '@type': 'Question',
                name: 'What states do you serve?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'We currently serve 44 US states. Our physicians are licensed in multiple states to ensure compliance with local medical regulations.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is my information secure?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Absolutely. We are HIPAA compliant and use industry-standard encryption to protect your personal and medical information. Your privacy is our top priority.',
                },
              },
              {
                '@type': 'Question',
                name: 'Do you accept insurance?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'No, we do not accept insurance. However, at only $24.95, our service is an affordable out-of-pocket option that saves you the time and expense of a traditional doctor visit.',
                },
              },
            ],
          }),
        }}
      />
    </div>
  )
}
