import type { Metadata } from 'next'
import Image from 'next/image'
import { Star, DollarSign, Phone, BadgeCheck, MapPin, Shield } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import HeroSection from '@/components/homepage/HeroSection'
import HowItWorksSection from '@/components/homepage/HowItWorksSection'
import FinalCTASection from '@/components/homepage/FinalCTASection'

export const metadata: Metadata = {
  title: "Online Doctor's Note - Get a Doctor's Note from Your Phone in Minutes",
  description:
    "Get a legitimate doctor's note for work or school in minutes. Board-certified physicians, HIPAA compliant, valid nationwide. Only $24.95 with money-back guarantee.",
  keywords: [
    "doctor's note",
    "online doctor note",
    'excuse note',
    'work excuse',
    'school absence note',
    'telehealth',
    'medical excuse',
  ],
  openGraph: {
    title: "Online Doctor's Note - Get Your Note in Minutes",
    description:
      'Get a legitimate doctor\'s note from a board-certified physician. Fast, affordable, and accepted nationwide.',
    type: 'website',
    url: 'https://onlinedoctornote.com',
  },
}

const testimonialAvatars = [
  '/images/avatars/avatar-1.jpg',
  '/images/avatars/avatar-2.jpg',
  '/images/avatars/avatar-3.jpg',
  '/images/avatars/avatar-4.jpg',
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section - Client Component */}
      <HeroSection />

      {/* How It Works - Client Component */}
      <HowItWorksSection />

      {/* What's Included - Server Component */}
      <section className="bg-gradient-to-b from-gray-50 to-white px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center md:mb-14">
            <h2 className="mb-4 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
              What&apos;s included
            </h2>
          </div>

          {/* Doctor image + feature cards layout */}
          <div className="grid items-start gap-10 lg:grid-cols-[340px_1fr] lg:gap-14">
            {/* Doctor image column */}
            <div className="flex flex-col items-center lg:sticky lg:top-8">
              <div className="relative mx-auto w-56 sm:w-64 lg:w-full">
                <Image
                  src="/images/stockvault-specialist-doctor177580.jpg"
                  alt="Board-certified doctor reviewing medical documentation"
                  width={680}
                  height={510}
                  quality={90}
                  className="relative rounded-2xl object-cover shadow-lg"
                />
              </div>
              <p className="mt-5 text-center text-sm font-medium text-gray-500 lg:mt-6">
                Every note is reviewed by a licensed physician
              </p>
            </div>

            {/* Feature cards column */}
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              {[
                {
                  icon: BadgeCheck,
                  title: 'Board-Certified Doctors',
                  description: 'Licensed physicians in your state',
                },
                {
                  icon: DollarSign,
                  title: '100% Money Back Guarantee',
                  description: "Full refund if your note isn't accepted",
                },
                {
                  icon: Phone,
                  title: 'Employer / School Verification',
                  description: 'We verify your note if contacted',
                },
                {
                  icon: Shield,
                  title: 'HIPAA Compliant',
                  description: 'Your information stays private',
                },
                {
                  icon: MapPin,
                  title: 'Valid Nationwide',
                  description: 'Accepted across 46 states',
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className={`group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 transition-all duration-300 hover:border-[#009ed9]/20 hover:shadow-lg hover:shadow-[#009ed9]/5 ${
                    index === 4 ? 'sm:col-span-2' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 rounded-xl bg-gradient-to-br from-[#009ed9]/10 to-[#009ed9]/5 p-2.5">
                      <item.icon className="h-5 w-5 text-[#009ed9]" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="mb-0.5 text-base font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600">{item.description}</p>
                    </div>
                  </div>

                  {/* Subtle hover accent */}
                  <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-[#009ed9]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - Server Component */}
      <section className="bg-gray-50 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <div className="mb-5 flex justify-center -space-x-3">
              {testimonialAvatars.map((src, i) => (
                <Image
                  key={i}
                  src={src}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border-2 border-white object-cover"
                />
              ))}
            </div>
            <h2 className="mb-4 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
              What our patients say
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                quote:
                  'Got my letter within 15 minutes. The process was incredibly smooth and professional.',
                author: 'Jessica M.',
                location: 'New York',
              },
              {
                quote:
                  "Way easier than going to the doctor's office. My employer accepted it without any questions.",
                author: 'Daniel R.',
                location: 'California',
              },
              {
                quote:
                  'My work called to verify and there was no issue. The verification service gave me complete peace of mind.',
                author: 'Chris H.',
                location: 'Texas',
              },
            ].map((testimonial, index) => (
              <figure key={index} className="rounded-xl border border-gray-200 bg-white p-6 md:p-8">
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="mb-6 text-gray-700">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="text-sm text-gray-500">
                  <strong className="text-gray-900">{testimonial.author}</strong> ·{' '}
                  {testimonial.location}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - Client Component */}
      <FinalCTASection />

      <Footer />
    </div>
  )
}
