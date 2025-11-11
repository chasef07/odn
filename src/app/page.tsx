'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Shield,
  Star,
  Clock,
  DollarSign,
  FileCheck,
  MousePointerClick,
  Lock,
  BadgeCheck,
  CheckCircle2,
  Mail,
  Phone,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card } from '@/components/ui/card'
import Header from '@/components/Header'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="px-6 pt-16 pb-16">
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

          <p className="mb-8 text-base">
            <span className="text-primary text-2xl font-bold">$24.95</span>
            <span className="text-muted-foreground"> • Money-Back Guarantee</span>
          </p>

          {/* Trust Badges */}
          <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-6 text-base">
            <div className="flex items-center gap-2">
              <Shield className="text-primary h-5 w-5" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="text-primary h-5 w-5" />
              <span>12,000+ Notes Issued</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-primary h-5 w-5" />
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
              <p className="text-muted-foreground text-center">Get your note in hours.</p>
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
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-4xl font-bold">Why OnlineDoctorNote?</h2>
          <p className="text-muted-foreground mb-16 text-center text-lg">
            The trusted choice for professional medical documentation
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Fast */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
              <h3 className="mb-2 text-xl font-semibold">Fast</h3>
              <p className="text-muted-foreground">
                Get your note in hours, not days. Our physicians review requests promptly.
              </p>
            </div>

            {/* Affordable */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
              <h3 className="mb-2 text-xl font-semibold">Affordable</h3>
              <p className="text-muted-foreground">
                Only $24.95 with no hidden fees. Save time and money compared to traditional visits.
              </p>
            </div>

            {/* Legal */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
              <h3 className="mb-2 text-xl font-semibold">Legal</h3>
              <p className="text-muted-foreground">
                Signed by licensed, board-certified physicians. Legitimate medical documentation.
              </p>
            </div>

            {/* Easy */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
              <h3 className="mb-2 text-xl font-semibold">Easy</h3>
              <p className="text-muted-foreground">
                100% online process. Complete the form in minutes from anywhere.
              </p>
            </div>

            {/* Secure */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
              <h3 className="mb-2 text-xl font-semibold">Secure</h3>
              <p className="text-muted-foreground">
                HIPAA compliant and fully confidential. Your privacy is our top priority.
              </p>
            </div>

            {/* Guaranteed */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
              <h3 className="mb-2 text-xl font-semibold">Guaranteed</h3>
              <p className="text-muted-foreground">
                100% money-back guarantee if your note is not accepted. Risk-free service.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-blue-50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-center text-4xl font-bold">Frequently Asked Questions</h2>
          <p className="text-muted-foreground mb-12 text-center text-lg">
            Everything you need to know about our service
          </p>

          <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-b px-4 last:border-b-0">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  How long does it take to get my note?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                  Most notes are delivered within 2-4 hours. Our board-certified physicians review
                  requests promptly to ensure you receive your note as quickly as possible.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border-b px-4 last:border-b-0">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  Is this legal?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                  Yes, completely legal. Our notes are signed by licensed, board-certified
                  physicians who review each case individually. These are legitimate medical
                  documents.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-b px-4 last:border-b-0">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  What can I use this note for?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                  Our notes can be used for work absences, school absences, and similar short-term
                  needs. They cannot be used for FMLA, workers&apos; compensation, legal issues, or
                  disability claims.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-b px-4 last:border-b-0">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  What if my employer or school doesn&apos;t accept it?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                  We offer a 100% money-back guarantee. If your note is not accepted, we&apos;ll
                  issue a full refund. Our notes are accepted by the vast majority of employers and
                  schools nationwide.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border-b px-4 last:border-b-0">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  What information do I need to provide?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                  You&apos;ll need basic personal information, the reason for your absence, dates
                  you need covered, and contact information. The entire process takes less than 2
                  minutes to complete.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="border-b px-4 last:border-b-0">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  What states do you serve?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                  We currently serve 44 US states. Our physicians are licensed in multiple states
                  to ensure compliance with local medical regulations.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="border-b px-4 last:border-b-0">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  Is my information secure?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                  Absolutely. We are HIPAA compliant and use industry-standard encryption to
                  protect your personal and medical information. Your privacy is our top priority.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8" className="border-b px-4 last:border-b-0">
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  Do you accept insurance?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                  No, we do not accept insurance. However, at only $24.95, our service is an
                  affordable out-of-pocket option that saves you the time and expense of a
                  traditional doctor visit.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
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
      <footer className="border-t bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-6xl">
          {/* HIPAA Badge */}
          <div className="mb-8 flex justify-center">
            <div className="inline-flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-6 py-3 shadow-sm">
              <Shield className="h-6 w-6 text-primary" />
              <div className="text-left">
                <div className="text-sm font-semibold text-gray-900">HIPAA Compliant</div>
                <div className="text-xs text-muted-foreground">Secure & Confidential</div>
              </div>
            </div>
          </div>

          {/* Footer Links */}
          <div className="text-muted-foreground mb-6 flex flex-wrap justify-center gap-6 text-sm">
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms-of-service" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>

          {/* Contact Info */}
          <div className="text-muted-foreground mb-6 flex flex-col items-center gap-3 text-sm">
            <a
              href="mailto:hello@onlinedoctornote.com"
              className="hover:text-foreground flex items-center gap-2 transition-colors"
            >
              <Mail className="text-primary h-4 w-4" />
              <span>hello@onlinedoctornote.com</span>
            </a>
            <div className="flex items-center gap-2">
              <Phone className="text-primary h-4 w-4" />
              <span>
                <a href="tel:917-300-8543" className="hover:text-foreground transition-colors">
                  917-300-8543
                </a>
                {' '}(8am–8pm EST everyday)
              </span>
            </div>
          </div>

          {/* Copyright */}
          <p className="text-muted-foreground text-center text-xs">
            © 2025 OnlineDoctorNote. All rights reserved.
          </p>
        </div>
      </footer>

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
