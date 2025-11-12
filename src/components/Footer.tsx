'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Mail, Phone } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t px-6 py-12" style={{ backgroundColor: '#001830' }}>
      <div className="mx-auto max-w-6xl">
        {/* Footer Links */}
        <div className="mb-6 flex flex-wrap justify-center gap-12 text-blue-100" style={{ fontSize: '1.10rem' }}>
          <Link href="/privacy-policy" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms-of-service" className="hover:text-white transition-colors">
            Terms of Service
          </Link>
        </div>

        {/* Contact Info */}
        <div className="mb-6 flex flex-col items-center gap-3 text-blue-100" style={{ fontSize: '1.10rem' }}>
          <a
            href="mailto:hello@onlinedoctornote.com"
            className="hover:text-white flex items-center gap-2 transition-colors"
          >
            <Mail className="h-5 w-5 text-blue-100" />
            <span>hello@onlinedoctornote.com</span>
          </a>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-blue-100" />
            <span>
              <a href="tel:917-300-8543" className="hover:text-white transition-colors">
                917-300-8543
              </a>
              {' '}(8am–8pm EST everyday)
            </span>
          </div>
        </div>

        {/* HIPAA Badge Image */}
        <div className="mb-6 flex justify-center">
          <Image
            src="/images/homepage/Hipaa-Compliant-Spanish-medical-translator.png"
            alt="HIPAA Compliant"
            width={50}
            height={25}
            className="h-auto w-auto"
          />
        </div>

        {/* Copyright */}
        <p className="text-center text-blue-100" style={{ fontSize: '1.10rem' }}>
          © 2025 OnlineDoctorNote.com
        </p>
      </div>
    </footer>
  )
}
