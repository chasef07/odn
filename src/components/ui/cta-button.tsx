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
      className={`bg-primary hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-xl px-12 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:shadow-xl ${className || ''}`}
    >
      {buttonText}
      <ArrowRight className="h-5 w-5" />
    </button>
  )
}
