import type { Metadata } from 'next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { englishAlternates, translate, translateReactTree, type Locale } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'FAQ - Frequently Asked Questions',
  description:
    "Get answers to common questions about online doctor's notes. Learn about our service, pricing, delivery time, and money-back guarantee.",
  alternates: englishAlternates('/faq'),
}

const faqs = [
  {
    question: 'Is this service legitimate?',
    answer:
      'Yes, absolutely. Our service connects you with real, board-certified physicians licensed in your state. Each note is reviewed and signed by a licensed doctor who evaluates your case. This is a legitimate telehealth service that follows all applicable healthcare regulations.',
  },
  {
    question: 'Will my employer or school accept the note?',
    answer:
      "Our notes are signed by board-certified doctors and contain all standard medical documentation elements. We have a 100% money-back guarantee—if your note isn't accepted for any reason, we'll issue a full refund. We also provide a verification service for employers and schools.",
  },
  {
    question: 'How quickly will I receive my note?',
    answer:
      'During business hours (8am-12am EST), most notes are delivered within 30 minutes to 2 hours. During off-hours, it may take slightly longer, but we always aim to be as quick as possible.',
  },
  {
    question: 'Can I get a note for past absences?',
    answer:
      'Yes, we can provide notes for absences that occurred within the past 7 days. Simply enter your absence dates when completing the form.',
  },
  {
    question: 'What can the note be used for?',
    answer:
      "Our notes can be used for work or school absences of up to 7 days. This covers mild illnesses, minor injuries, mental health days, doctor's appointments, and caregiver duties. We cannot provide notes for FMLA, legal matters, disability claims, or return-to-work clearance.",
  },
  {
    question: 'Do you accept insurance?',
    answer:
      "We don't accept insurance, but at $24.95, our service is typically less than most insurance copays—and you don't have to leave your home or take time off work to visit a doctor's office.",
  },
]

export function FAQPageContent(locale: Locale = 'en') {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: translate(locale, faq.question),
      acceptedAnswer: {
        '@type': 'Answer',
        text: translate(locale, faq.answer),
      },
    })),
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className="px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
              Frequently Asked Questions
            </h1>
            <p className="text-lg text-gray-600">Everything you need to know about our service</p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((item, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-lg border border-gray-200 bg-white px-4 sm:px-6"
              >
                <AccordionTrigger className="py-4 text-left text-base font-medium text-gray-900 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-gray-600">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function FAQPage({ locale = 'en' }: { locale?: Locale }) {
  return translateReactTree(FAQPageContent(locale), locale)
}
