'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowRight, Star } from 'lucide-react'

const herophrases = ['From Your Phone', 'Within Minutes', 'For Only $24.95']

export default function HeroSection() {
  const router = useRouter()
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
  }, [])

  return (
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
  )
}
