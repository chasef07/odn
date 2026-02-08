'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowRight, Star, DollarSign, Phone, BadgeCheck, MapPin, Shield } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function HomePage() {
  const router = useRouter()
  const [visibleSteps, setVisibleSteps] = useState<Set<number>>(new Set())
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])

  const herophrases = [
    'From Your Phone',
    'Within Minutes',
    'For Only $24.95',
  ]
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % herophrases.length)
        setIsAnimating(false)
      }, 300)
    }, 4500)
    return () => clearInterval(interval)
  }, [herophrases.length])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-step'))
            setVisibleSteps((prev) => new Set([...prev, index]))
          }
        })
      },
      { threshold: 0.3, rootMargin: '0px 0px -50px 0px' }
    )

    stepRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section - Clean White */}
      <section className="relative overflow-hidden bg-white px-5 py-10 md:px-6 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
            {/* Left - Text Content */}
            <div className="order-1 text-left">
              <h1 className="font-hero animate-fade-in-up mb-3 text-4xl font-bold leading-[1.1] tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
                Get a Doctor&apos;s Note
                <span
                  className={`block whitespace-nowrap text-[#009ed9] transition-all duration-300 ${
                    isAnimating ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
                  }`}
                >
                  {herophrases[phraseIndex]}
                </span>
              </h1>

              {/* Rating */}
              <div className="animate-fade-in stagger-1 mb-6">
                <div className="flex items-center">
                  {/* 4 full stars */}
                  {[...Array(4)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                  {/* Half star */}
                  <div className="relative h-4 w-4">
                    <Star className="absolute h-4 w-4 text-gray-300" />
                    <div className="absolute overflow-hidden" style={{ width: '70%' }}>
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    </div>
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-600">Trusted by 30,000+ patients across the US</p>
              </div>

              {/* CTA */}
              <div className="animate-fade-in-up stagger-2 flex flex-col items-start">
                <button
                  onClick={() => router.push('/start')}
                  className="font-hero group inline-flex items-center justify-center gap-2 rounded-full bg-[#009ed9] px-8 py-3.5 text-base font-medium text-white transition-all duration-300 hover:bg-[#00b4f5]"
                >
                  Get Your Note
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
                <p className="mt-2 text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">$24.95</span> · Money-Back Guarantee
                </p>
              </div>
            </div>

            {/* Right - Doctor Note */}
            <div className="order-2 flex justify-center">
              <div className="animate-fade-in-up stagger-1">
                <Image
                  src="/images/homepage/Doctor-Note-letter-1024px.png"
                  alt="Sample doctor's note"
                  width={600}
                  height={548}
                  quality={90}
                  priority
                  className="w-full max-w-lg drop-shadow-2xl transition-transform duration-500 hover:scale-105"
                />
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* How It Works - Clean 3-Step */}
      <section id="how-it-works" className="bg-white px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
              How it works
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              Three simple steps to get your doctor&apos;s note
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 md:gap-12">
            {[
              {
                step: '1',
                title: 'Complete the form',
                description: 'Answer a few simple questions about your absence. Takes about 2 minutes.',
              },
              {
                step: '2',
                title: 'Doctor reviews',
                description: 'A board-certified physician licensed in your state reviews your request.',
              },
              {
                step: '3',
                title: 'Receive your note',
                description: 'Get your signed doctor\'s note delivered straight to your email inbox.',
              },
            ].map((item, index) => (
              <div
                key={index}
                ref={(el) => { stepRefs.current[index] = el }}
                data-step={index}
                className={`relative flex items-start gap-5 transition-all duration-700 ease-out ${
                  visibleSteps.has(index)
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-8 opacity-0'
                }`}
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#009ed9]/10 to-[#009ed9]/5 text-xl font-bold text-[#009ed9]">
                  {item.step}
                </div>
                <div>
                  <h3 className="mb-1 text-xl font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            ref={(el) => { stepRefs.current[3] = el }}
            data-step={3}
            className={`mt-12 text-center transition-all duration-700 ease-out ${
              visibleSteps.has(3)
                ? 'translate-y-0 opacity-100'
                : 'translate-y-8 opacity-0'
            }`}
          >
            <button
              onClick={() => router.push('/start')}
              className="font-hero group inline-flex items-center gap-2 rounded-full bg-[#009ed9] px-8 py-4 text-base font-medium text-white transition-all duration-300 hover:bg-[#00b4f5] hover:shadow-lg hover:shadow-[#009ed9]/25"
            >
              Get Your Note
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* What's Included */}
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
                  alt="Board-certified doctor"
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
                  description: 'Full refund if your note isn\'t accepted',
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


      {/* Testimonials - Clean Cards */}
      <section className="bg-gray-50 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <div className="mb-5 flex justify-center -space-x-3">
              {[
                'https://randomuser.me/api/portraits/women/44.jpg',
                'https://randomuser.me/api/portraits/men/32.jpg',
                'https://randomuser.me/api/portraits/women/68.jpg',
                'https://randomuser.me/api/portraits/men/75.jpg',
              ].map((src, i) => (
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
                quote: "Got my letter within 15 minutes. The process was incredibly smooth and professional.",
                author: "Jessica M.",
                location: "New York"
              },
              {
                quote: "Way easier than going to the doctor's office. My employer accepted it without any questions.",
                author: "Daniel R.",
                location: "California"
              },
              {
                quote: "My work called to verify and there was no issue. The verification service gave me complete peace of mind.",
                author: "Chris H.",
                location: "Texas"
              }
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
                  <strong className="text-gray-900">{testimonial.author}</strong> · {testimonial.location}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>



      {/* Final CTA - Simple */}
      <section className="bg-gray-900 px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Get Your Doctor&apos;s Note<br className="sm:hidden" /> From the Comfort of Your Home
          </h2>
          <p className="mb-8 text-lg text-gray-400">
            Skip the waiting room. Get started now.
          </p>
          <button
            onClick={() => router.push('/start')}
            className="inline-flex items-center gap-2 rounded-full bg-[#009ed9] px-8 py-4 text-base font-medium text-white transition-all hover:bg-[#00b4f5]"
          >
            Get Your Note — $24.95
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
