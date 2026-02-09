'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

export default function FinalCTASection() {
  const router = useRouter()

  return (
    <section className="bg-gray-900 px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="mb-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Get Your Doctor&apos;s Note
          <br className="sm:hidden" /> From the Comfort of Your Home
        </h2>
        <p className="mb-8 text-lg text-gray-400">Skip the waiting room. Get started now.</p>
        <button
          onClick={() => router.push('/start')}
          className="inline-flex items-center gap-2 rounded-full bg-[#009ed9] px-8 py-4 text-base font-medium text-white transition-all hover:bg-[#00b4f5]"
        >
          Get Your Note — $24.95
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  )
}
