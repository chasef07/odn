'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle2, ArrowRight, Shield, Star } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="px-6 pt-24 pb-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-display text-foreground mb-6 text-5xl font-bold sm:text-6xl">
            Get Your Doctor&apos;s Note Online
          </h1>
          <p className="text-muted-foreground mb-8 text-2xl">Fast, Legal, Affordable</p>
          <p className="text-muted-foreground mb-10 text-lg">
            Board-certified physicians. 100% online. Delivered in hours.
          </p>

          {/* Primary CTA */}
          <button
            onClick={() => router.push('/start')}
            className="bg-primary hover:bg-primary/90 mb-4 inline-flex items-center justify-center gap-2 rounded-xl px-12 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:shadow-xl"
          >
            Get Your Note Now
            <ArrowRight className="h-5 w-5" />
          </button>

          <p className="text-muted-foreground mb-8 text-sm">Only $24.95 • Money-Back Guarantee</p>

          {/* Trust Badges */}
          <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="text-primary h-4 w-4" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="text-primary h-4 w-4" />
              <span>12,000+ Notes Issued</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-primary h-4 w-4" />
              <span>Licensed Doctors</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-blue-50 px-6 py-16">
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
                It only takes a few minutes. Available 24/7/365.
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
            <button
              onClick={() => router.push('/start')}
              className="bg-primary hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-xl px-12 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:shadow-xl"
            >
              Get Your Note Now
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-4xl font-bold">Why OnlineDoctorNote?</h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <div>
                <h3 className="mb-1 text-lg font-semibold">Fast</h3>
                <p className="text-muted-foreground">Get your note in hours, not days</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <div>
                <h3 className="mb-1 text-lg font-semibold">Affordable</h3>
                <p className="text-muted-foreground">Only $24.95, no hidden fees</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <div>
                <h3 className="mb-1 text-lg font-semibold">Legal</h3>
                <p className="text-muted-foreground">Signed by board-certified physicians</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <div>
                <h3 className="mb-1 text-lg font-semibold">Easy</h3>
                <p className="text-muted-foreground">100% online, no appointment needed</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <div>
                <h3 className="mb-1 text-lg font-semibold">Secure</h3>
                <p className="text-muted-foreground">HIPAA compliant and confidential</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-500" />
              <div>
                <h3 className="mb-1 text-lg font-semibold">Guaranteed</h3>
                <p className="text-muted-foreground">100% money-back guarantee</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-blue-50/50 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-4xl font-bold">Frequently Asked Questions</h2>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left">
                How long does it take to get my note?
              </AccordionTrigger>
              <AccordionContent>
                Most notes are delivered within 2-4 hours. Our board-certified physicians review
                requests promptly to ensure you receive your note as quickly as possible.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left">Is this legal?</AccordionTrigger>
              <AccordionContent>
                Yes, completely legal. Our notes are signed by licensed, board-certified physicians
                who review each case individually. These are legitimate medical documents.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left">
                What can I use this note for?
              </AccordionTrigger>
              <AccordionContent>
                Our notes can be used for work absences, school absences, and similar short-term
                needs. They cannot be used for FMLA, workers&apos; compensation, legal issues, or
                disability claims.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left">
                What if my employer or school doesn&apos;t accept it?
              </AccordionTrigger>
              <AccordionContent>
                We offer a 100% money-back guarantee. If your note is not accepted, we&apos;ll issue
                a full refund. Our notes are accepted by the vast majority of employers and schools
                nationwide.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-left">
                What information do I need to provide?
              </AccordionTrigger>
              <AccordionContent>
                You&apos;ll need basic personal information, the reason for your absence, dates you
                need covered, and contact information. The entire process takes less than 2 minutes
                to complete.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="text-left">What states do you serve?</AccordionTrigger>
              <AccordionContent>
                We currently serve 44 US states. Our physicians are licensed in multiple states to
                ensure compliance with local medical regulations.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger className="text-left">Is my information secure?</AccordionTrigger>
              <AccordionContent>
                Absolutely. We are HIPAA compliant and use industry-standard encryption to protect
                your personal and medical information. Your privacy is our top priority.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger className="text-left">Do you accept insurance?</AccordionTrigger>
              <AccordionContent>
                No, we do not accept insurance. However, at only $24.95, our service is an
                affordable out-of-pocket option that saves you the time and expense of a traditional
                doctor visit.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-4xl font-bold">Ready to Get Your Doctor&apos;s Note?</h2>
          <p className="text-muted-foreground mb-8 text-xl">Join 12,000+ satisfied customers</p>

          <button
            onClick={() => router.push('/start')}
            className="bg-primary hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-xl px-12 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:shadow-xl"
          >
            Get Started - $24.95
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-muted-foreground mb-6 flex flex-wrap justify-center gap-6 text-sm">
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <span>•</span>
            <a href="#" className="hover:text-foreground transition-colors">
              Terms of Service
            </a>
            <span>•</span>
            <a href="#" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </div>

          <p className="text-muted-foreground mb-4 text-center text-sm">
            <span className="font-medium">Please note:</span> This service is not meant to be used
            for legal issues, FMLA, workman&apos;s compensation, or disability and insurance claims.
            You must be 18+ or a parent / guardian requesting for a minor.
          </p>

          <p className="text-muted-foreground text-center text-xs">
            © 2025 OnlineDoctorNote. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
