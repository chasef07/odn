'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'

const steps = [
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
    description: "Get your signed doctor's note delivered straight to your email inbox.",
  },
]

export default function HowItWorksSection() {
  const router = useRouter()
  const [visibleSteps, setVisibleSteps] = useState<Set<number>>(new Set())
  const stepRefs = useRef<(HTMLDivElement | null)[]>([])

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
          {steps.map((item, index) => (
            <div
              key={index}
              ref={(el) => {
                stepRefs.current[index] = el
              }}
              data-step={index}
              className={`relative flex items-start gap-5 transition-all duration-700 ease-out ${
                visibleSteps.has(index) ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
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
          ref={(el) => {
            stepRefs.current[3] = el
          }}
          data-step={3}
          className={`mt-12 text-center transition-all duration-700 ease-out ${
            visibleSteps.has(3) ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
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
  )
}
