'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CTAButton } from '@/components/ui/cta-button'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-[#004387] shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Logo */}
          <Link href="/">
            <Image
              src="/images/homepage/OnlineDoctorNote_logo.png"
              alt="OnlineDoctorNote"
              width={250}
              height={62}
              className="h-auto w-auto max-w-[180px] md:max-w-none"
              priority
            />
          </Link>

          {/* CTA Button */}
          <CTAButton className="!px-3 !py-1.5 !text-xs md:!px-6 md:!py-2 md:!text-base whitespace-nowrap" />
        </div>
      </div>
    </header>
  )
}
