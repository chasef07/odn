'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Mail, Phone } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t bg-[#001830] px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Footer Links */}
        <div className="mb-6 flex flex-wrap justify-center gap-12 text-white text-[1.10rem]">
          <Link href="/privacy-policy" className="hover:text-gray-200 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms-of-service" className="hover:text-gray-200 transition-colors">
            Terms of Service
          </Link>
        </div>

        {/* Contact Info */}
        <div className="mb-6 flex flex-col items-center gap-3 text-white text-[1.10rem]">
          <a
            href="mailto:hello@onlinedoctornote.com"
            className="hover:text-gray-200 flex items-center gap-2 transition-colors"
          >
            <Mail className="h-5 w-5 text-white" />
            <span>hello@onlinedoctornote.com</span>
          </a>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-white" />
            <span>
              <a href="tel:917-300-8543" className="hover:text-gray-200 transition-colors">
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
            alt="HIPAA Compliant - Health Insurance Portability and Accountability Act certified medical documentation service"
            width={50}
            height={25}
            className="h-auto w-auto"
          />
        </div>

        {/* Copyright */}
        <p className="text-center text-white text-[1.10rem]">
          © 2025 OnlineDoctorNote.com
        </p>

        {/* Powered By */}
        <p className="mt-2 text-center text-white text-sm">
          Powered By{' '}
          <a
            href="https://www.databuddiessolutions.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-200 transition-colors underline"
          >
            Data Buddies
          </a>
        </p>
      </div>
    </footer>
  )
}
