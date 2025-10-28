"use client";

import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowRight, Shield, Star } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-24 pb-16 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-5xl sm:text-6xl font-display font-bold text-foreground mb-6">
            Get Your Doctor&apos;s Note Online
          </h1>
          <p className="text-2xl text-muted-foreground mb-8">
            Fast, Legal, Affordable
          </p>
          <p className="text-lg text-muted-foreground mb-10">
            Board-certified physicians. 100% online. Delivered in hours.
          </p>

          {/* Primary CTA */}
          <button
            onClick={() => router.push('/start')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-12 py-4 text-lg font-semibold text-white shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all mb-4"
          >
            Get Your Note Now
            <ArrowRight className="h-5 w-5" />
          </button>

          <p className="text-sm text-muted-foreground mb-8">
            Only $24.95 • Money-Back Guarantee
          </p>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              <span>12,000+ Notes Issued</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Licensed Doctors</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-blue-50 py-16 px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-4xl font-bold mb-12">How it Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-6 items-center">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                1
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Complete the Online Form</h3>
              <p className="text-center text-muted-foreground">
                It only takes a few minutes. Available 24/7/365.
              </p>
            </div>

            {/* Arrow */}
            <ArrowRight className="hidden md:block mx-auto text-primary h-8 w-8" />

            {/* Step 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                2
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Get Doctor Approval</h3>
              <p className="text-center text-muted-foreground">
                A board-certified doctor will sign your note.
              </p>
            </div>

            {/* Arrow */}
            <ArrowRight className="hidden md:block mx-auto text-primary h-8 w-8" />

            {/* Step 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                3
              </div>
              <h3 className="text-xl font-bold text-center mb-2">Get Your Note</h3>
              <p className="text-center text-muted-foreground">
                Delivered by email in minutes.
              </p>
            </div>
          </div>

          {/* CTA Below Boxes */}
          <div className="text-center mt-12">
            <button
              onClick={() => router.push('/start')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-12 py-4 text-lg font-semibold text-white shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all"
            >
              Get Your Note Now
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-4xl font-bold mb-12">Why OnlineDoctorNote?</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Fast</h3>
                <p className="text-muted-foreground">Get your note in hours, not days</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Affordable</h3>
                <p className="text-muted-foreground">Only $24.95, no hidden fees</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Legal</h3>
                <p className="text-muted-foreground">Signed by board-certified physicians</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Easy</h3>
                <p className="text-muted-foreground">100% online, no appointment needed</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Secure</h3>
                <p className="text-muted-foreground">HIPAA compliant and confidential</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold mb-1">Guaranteed</h3>
                <p className="text-muted-foreground">100% money-back guarantee</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-6 bg-blue-50/50">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-4xl font-bold mb-12">Frequently Asked Questions</h2>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left">How long does it take to get my note?</AccordionTrigger>
              <AccordionContent>
                Most notes are delivered within 2-4 hours. Our board-certified physicians review requests promptly to ensure you receive your note as quickly as possible.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left">Is this legal?</AccordionTrigger>
              <AccordionContent>
                Yes, completely legal. Our notes are signed by licensed, board-certified physicians who review each case individually. These are legitimate medical documents.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left">What can I use this note for?</AccordionTrigger>
              <AccordionContent>
                Our notes can be used for work absences, school absences, and similar short-term needs. They cannot be used for FMLA, workers&apos; compensation, legal issues, or disability claims.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left">What if my employer or school doesn&apos;t accept it?</AccordionTrigger>
              <AccordionContent>
                We offer a 100% money-back guarantee. If your note is not accepted, we&apos;ll issue a full refund. Our notes are accepted by the vast majority of employers and schools nationwide.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger className="text-left">What information do I need to provide?</AccordionTrigger>
              <AccordionContent>
                You&apos;ll need basic personal information, the reason for your absence, dates you need covered, and contact information. The entire process takes less than 2 minutes to complete.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger className="text-left">What states do you serve?</AccordionTrigger>
              <AccordionContent>
                We currently serve 44 US states. Our physicians are licensed in multiple states to ensure compliance with local medical regulations.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7">
              <AccordionTrigger className="text-left">Is my information secure?</AccordionTrigger>
              <AccordionContent>
                Absolutely. We are HIPAA compliant and use industry-standard encryption to protect your personal and medical information. Your privacy is our top priority.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8">
              <AccordionTrigger className="text-left">Do you accept insurance?</AccordionTrigger>
              <AccordionContent>
                No, we do not accept insurance. However, at only $24.95, our service is an affordable out-of-pocket option that saves you the time and expense of a traditional doctor visit.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Your Doctor&apos;s Note?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join 12,000+ satisfied customers
          </p>

          <button
            onClick={() => router.push('/start')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-12 py-4 text-lg font-semibold text-white shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all"
          >
            Get Started - $24.95
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mb-6">
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
            <span>•</span>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>

          <p className="text-center text-sm text-muted-foreground mb-4">
            <span className="font-medium">Please note:</span> This service is not meant to be used for legal issues, FMLA, workman&apos;s compensation, or disability and insurance claims. You must be 18+ or a parent / guardian requesting for a minor.
          </p>

          <p className="text-center text-xs text-muted-foreground">
            © 2025 OnlineDoctorNote. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
