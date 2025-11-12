'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CTAButton } from '@/components/ui/cta-button'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b shadow-sm" style={{ backgroundColor: '#004387' }}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Logo */}
          <Link href="/">
            <Image
              src="/images/homepage/OnlineDoctorNote_logo.png"
              alt="OnlineDoctorNote"
              width={200}
              height={50}
              className="h-auto w-auto"
              priority
            />
          </Link>

          {/* CTA Button */}
          <CTAButton className="!px-6 !py-2 !text-base" />
        </div>
      </div>
    </header>
  )
}
