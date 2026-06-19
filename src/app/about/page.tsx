import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'About Us | OnlineDoctorNote',
  description:
    'Learn about OnlineDoctorNote - our mission, values, and commitment to providing legitimate, doctor-signed medical documentation.',
  alternates: {
    canonical: '/about',
  },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section className="px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
              About Us
            </h1>
            <p className="text-lg text-gray-600">Healthcare documentation, simplified</p>
          </div>

          <div className="overflow-hidden rounded-2xl">
            <Image
              src="/images/homepage/about-us.jpg"
              alt="OnlineDoctorNote team providing telehealth services"
              width={800}
              height={500}
              className="h-auto w-full object-cover"
              priority
            />
          </div>

          <div className="mx-auto mt-10 max-w-3xl md:mt-14">
            <p className="text-lg leading-relaxed text-gray-600">
              We believe getting a doctor&apos;s note shouldn&apos;t require hours in a waiting
              room. Our mission is to provide convenient, legitimate telehealth services that
              respect your time.
            </p>
          </div>
        </div>
      </section>

      {/* Why We Started */}
      <section className="border-t border-gray-100 bg-gray-50 px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-3xl font-semibold tracking-tight text-gray-900">
            Why we started
          </h2>
          <div className="space-y-6 text-lg leading-relaxed text-gray-600">
            <p>
              We saw a gap between people needing simple medical documentation and a healthcare
              system that often requires taking an entire day off work just to get a note for being
              sick.
            </p>
            <p>
              For minor illnesses, mental health days, or caring for a family member, the
              traditional process doesn&apos;t make sense. You&apos;re already feeling unwell—the
              last thing you need is to sit in a waiting room for hours.
            </p>
            <p>
              That&apos;s why we built OnlineDoctorNote: a legitimate telehealth service that
              connects you with board-certified physicians who can evaluate your situation and
              provide proper documentation, all from the comfort of your home.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 px-4 py-16 md:px-6 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight text-white">
            Get Your Doctor&apos;s Note in Minutes
          </h2>
          <p className="mb-8 text-gray-400">Skip the waiting room. Get started now.</p>
          <Link
            href="/start"
            className="inline-flex items-center gap-2 rounded-full bg-[#009ed9] px-8 py-4 text-base font-medium text-white transition-all hover:bg-[#00b4f5]"
          >
            Get Your Note — $24.95
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
