'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CTAButton } from '@/components/ui/cta-button'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-[#004387] shadow-sm">
      <div className="px-4 py-4 md:px-6">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <Image
              src="/images/homepage/OnlineDoctorNote_logo.png"
              alt="OnlineDoctorNote"
              width={250}
              height={62}
              className="h-auto w-auto max-w-[140px] md:max-w-none"
              priority
            />
          </Link>

          {/* CTA Button */}
          <CTAButton />
        </div>
      </div>
    </header>
  )
}
