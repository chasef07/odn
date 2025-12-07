'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

interface CTAButtonProps {
  text?: string
  showPrice?: boolean
  className?: string
}

export function CTAButton({
  text = 'Get Your Note Now',
  showPrice = false,
  className,
}: CTAButtonProps) {
  const router = useRouter()

  const buttonText = showPrice ? 'Get Started - $24.95' : text

  return (
    <button
      type="button"
      onClick={() => router.push('/start')}
      className={`bg-primary hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl md:px-12 md:py-4 md:text-lg ${className || ''}`}
    >
      <span className="hidden sm:inline">{buttonText}</span>
      <span className="sm:hidden">Get Note Now</span>
      <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
    </button>
  )
}
